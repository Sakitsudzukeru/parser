import { Pool } from "pg";
import fs from "fs";
import path from "path";
import readline from "readline";

const POSTGRES_MAX_PARAMS = 65535;

export default class Parser {
  private pool: Pool;
  private columnNames: string[];
  private limit: number;
  private createTableDone: boolean = false;

  constructor(pool: Pool, columnNames: string[], limit: number = 1000) {
    this.pool = pool;
    this.columnNames = columnNames;
    const maxSafeBatch = Math.floor(POSTGRES_MAX_PARAMS / columnNames.length);
    this.limit = Math.min(limit, maxSafeBatch);
  }

  private parseLine(line: string): any | null {
    try {
      let processedLine = line.replace(/\{/g, "");
      processedLine = processedLine.replace(/;\}/g, "");
      const parts = processedLine.split(";");

      while (parts.length > 0 && parts[parts.length - 1].trim() === "") {
        parts.pop();
      }

      const result: any = {};

      for (let i = 0; i < this.columnNames.length; i++) {
        const columnName = this.columnNames[i];
        let value = i < parts.length ? parts[i].trim() : "";

        if (value === "" || value === "null") {
          result[columnName] = null;
        } else {
          result[columnName] = value;
        }
      }

      return result;
    } catch (error) {
      console.error(`Ошибка парсинга строки: ${error}`); //In english: String parsing error
      return null;
    }
  }

  private async setupTable(client: any): Promise<string[]> {
    if (this.createTableDone) {
      const columnCheckResult = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'sdr_data';
        `);
      return columnCheckResult.rows.map(
        (row: { column_name: string }) => row.column_name,
      );
    }

    const tableCheckResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'sdr_data'
        );
      `);

    if (!tableCheckResult.rows[0].exists) {
      const createTableQuery = `
          CREATE TABLE sdr_data (
            ${this.columnNames.map((col) => `"${col}" TEXT`).join(", ")}
          );
        `;
      await client.query(createTableQuery);
      this.createTableDone = true;
      return this.columnNames;
    }

    const columnCheckResult = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'sdr_data';
      `);

    const existingColumns = columnCheckResult.rows.map(
      (row: { column_name: string }) => row.column_name,
    );

    const missingColumns = this.columnNames.filter(
      (col) => !existingColumns.includes(col),
    );

    for (const col of missingColumns) {
      await client.query(`ALTER TABLE sdr_data ADD COLUMN "${col}" TEXT;`);
    }

    this.createTableDone = true;
    return [...existingColumns, ...missingColumns];
  }

  private async insertBatch(
    data: any[],
    client: any,
    existingColumns: string[],
  ): Promise<void> {
    if (data.length === 0) return;

    try {
      const columns = this.columnNames.filter((col) =>
        existingColumns.includes(col),
      );

      const values = [];
      const placeholders = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowValues = columns.map((col) => row[col] ?? null);
        values.push(...rowValues);

        const rowPlaceholders = columns
          .map((_, idx) => `$${i * columns.length + idx + 1}`)
          .join(", ");
        placeholders.push(`(${rowPlaceholders})`);
      }

      const query = `
          INSERT INTO sdr_data (${columns.map((col) => `"${col}"`).join(", ")}) 
          VALUES ${placeholders.join(", ")}
        `;

      await client.query(query, values);
    } catch (error) {
      console.error("Ошибка при вставке пакета данных:", error); // In english: Error inserting data packet
      throw error;
    }
  }

  async processFile(filePath: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      const totalLines = fs.statSync(filePath).size;
      let bytesRead = 0;

      const existingColumns = await this.setupTable(client);

      const fileStream = fs.createReadStream(filePath, {
        encoding: "utf8",
        highWaterMark: 64 * 1024,
      });
      fileStream.on("data", (chunk) => {
        bytesRead += Buffer.byteLength(chunk as string, "utf8");
      });

      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let batch: any[] = [];
      let lineCount = 0;
      const COMMIT_EVERY_N_BATCHES = 20;
      let batchesSinceCommit = 0;

      await client.query("BEGIN");

      for await (const line of rl) {
        if (line.trim()) {
          const parsedData = this.parseLine(line);

          if (parsedData) {
            batch.push(parsedData);
            lineCount++;

            if (batch.length >= this.limit) {
              await this.insertBatch(batch, client, existingColumns);
              batchesSinceCommit++;
              batch = [];

              const progress = ((bytesRead / totalLines) * 100).toFixed(2);
              console.log(`Прогресс: ${progress}% (строк: ${lineCount})`); //In english: Progress: , lines:

              if (batchesSinceCommit >= COMMIT_EVERY_N_BATCHES) {
                await client.query("COMMIT");
                await client.query("BEGIN");
                batchesSinceCommit = 0;
              }
            }
          }
        }
      }

      if (batch.length > 0) {
        await this.insertBatch(batch, client, existingColumns);
        console.log(`Прогресс: 100.00% (строк: ${lineCount})`); //In english: Process, lines
      }

      await client.query("COMMIT");
      console.log(`Файл обработан: ${filePath}, всего строк: ${lineCount}`); //In english: The file has been processed, total lines
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`Ошибка при обработке файла ${filePath}:`, error); // In english: File processing error
      throw error;
    } finally {
      client.release();
    }
  }

  async processFiles(folderPath: string): Promise<void> {
    if (!fs.existsSync(folderPath)) {
      console.error(`Папка не найдена: ${folderPath}`); // In english: folder not found
      return;
    }

    const files = await fs.promises.readdir(folderPath);
    const cdrFiles = files.filter((file) => file.endsWith(".cdr"));

    if (cdrFiles.length === 0) {
      console.warn("Не найдено файлов с расширением cdr"); // In english: No files with the cdr extension were found
      return;
    }

    const failures: { file: string; error: unknown }[] = [];

    for (const file of cdrFiles) {
      const fullPath = path.join(folderPath, file);
      console.log(`Начало обработки файла: ${fullPath}`); //In english: Start file processing
      try {
        await this.processFile(fullPath);
      } catch (error) {
        console.error(`Файл ${file} не обработан:`, error); // In english: File not processed
        failures.push({ file, error });
      }
    }

    if (failures.length > 0) {
      console.warn(
        `Обработка завершена с ошибками в ${failures.length} из ${cdrFiles.length} файлов`, //In english: Processing completed with errors
      );
    } else {
      console.log("Все файлы обработаны успешно."); // In english: All files processed successfully
    }
  }
}
