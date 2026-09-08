import express, { Request, Response } from "express";
import { pool } from "./db/connection";
import Parser from "./parser";
import { columnNames } from "./utils/constatns";
import { UploadedFile } from "./types/interface";
const multer = require("multer");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3002;

//base path
const SDR_ROOT = path.resolve(path.join(__dirname, "..", "sdr"));
const SDR_ACTUAL_DIR = path.join(SDR_ROOT, "actual");
const SDR_HISTORY_DIR = path.join(SDR_ROOT, "history");
const SDR_FAILED_DIR = path.join(SDR_ROOT, "failed");

const upload = multer({
  dest: "uploads/",
});

type MulterRequest = Request & { file?: UploadedFile };

let isProcessing = false;

app.post(
  "/upload-sdr-file",
  upload.single("file"),
  async (req: MulterRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Файл не был загружен", // In english: The file was not uploaded
      });
    }

    if (isProcessing) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(429).json({
        success: false,
        message:
          "Сейчас уже обрабатывается другой файл, повторите попытку позже", // In english: Another file is already being processed, please try again later
      });
    }

    const safeName = path.basename(req.file.originalname);
    const uploadedFilePath = req.file.path;
    const targetFilePath = path.join(SDR_ACTUAL_DIR, safeName);

    isProcessing = true;

    try {
      await fs.mkdir(SDR_ACTUAL_DIR, { recursive: true });
      await fs.mkdir(SDR_HISTORY_DIR, { recursive: true });
      await fs.mkdir(SDR_FAILED_DIR, { recursive: true });

      await fs.rename(uploadedFilePath, targetFilePath);
      console.log(`Файл сохранен в: ${targetFilePath}`); // In english: The file has been saved in

      const processor = new Parser(pool, columnNames);
      await processor.processFile(targetFilePath);

      const historyFilePath = path.join(SDR_HISTORY_DIR, safeName);
      await fs.rename(targetFilePath, historyFilePath);
      console.log(`Файл перемещен в историю: ${historyFilePath}`); //In english: The file has been moved to history

      res.json({
        success: true,
        message: "Файл успешно обработан и перемещен в историю", //In english: The file was successfully processed and moved to history
        filename: req.file.originalname,
      });
    } catch (error) {
      console.error("Ошибка при обработке файла:", error); // In english: File processing error

      try {
        await fs.rename(targetFilePath, path.join(SDR_FAILED_DIR, safeName));
      } catch {}

      res.status(500).json({
        success: false,
        message: "Ошибка при обработке файла", // In english: File processing error
      });
    } finally {
      isProcessing = false;
    }
  },
);

app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`); //In englsih: The server is running on port
});
