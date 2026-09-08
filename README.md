НАЗНАЧЕНИЕ
Микросервис для потоковой обработки CDR-файлов и загрузки в PostgreSQL. Построчный стриминг, батчи (расчинан на большие файлы)
PURPOSE
Microservice for streaming CDR files and loading them into PostgreSQL. Line-by-line streaming, batches (designed for large files)

СТРУКТУРА
src->parser->index.ts (парсинг и запись в бдшку)
src->index.ts (загрузка файла)
src->db->connection.ts (коннект к бдшке)
sdr-> /actual or /history or /failed (процессы)
uploads (временная папка загрузки файла, не спрашивайте зачем она, когда код писался, ее значимость была высокой, ну, во всяком, я так думала :D)
STRUCTURE
src->parser->index.ts (parsing and writing to the database)
src->index.ts (file upload)
src->db->connection.ts (connect to the database)
sdr-> /actual or /history or /failed (processes)
uploads (temporary file upload folder; don't ask why it's there; when the code was written, it was highly important, or so I thought :D)

ФОРМАТ ДАННЫХ
Одна запись на строку, поля через ;, запись в фигурных скобках. Вложенные объекты разворачиваются в плоские колонки при парсинге:
{d_0;d_1;d_2;...;{d_7_1;...;d_7_6;};{d_8_1;...;d_8_6;};d_9;...;d_18;} (вы подставляете разумеется свои данные)
DATA FORMAT
One record per line, fields separated by ;, records in curly brackets. Nested objects are expanded into flat columns during parsing:
{d_0;d_1;d_2;...;{d_7_1;...;d_7_6;};{d_8_1;...;d_8_6;};d_9;...;d_18;} (you substitute your own data, of course)

ЗАПУСК
npm install
.env->////
DB_USER=dbUser
DB_HOST=dbHost
DB_NAME=dbName
DB_PASSWORD=dbPassword
DB_PORT=5432 (default)
<-////

Запуск сервера -> npx tsx src/index.ts
Загрузка файла -> curl -X POST http://localhost:3002/upload-sdr-file -F "file=@sample.cdr" (на случай, кому лень ставить postman или расширение в vscode)

START
npm install
.env->////
DB_USER=dbUser
DB_HOST=dbHost
DB_NAME=dbName
DB_PASSWORD=dbPassword
DB_PORT=5432 (default)
<-////

Start server -> npx tsx src/index.ts
Upload file -> curl -X POST http://localhost:3002/upload-sdr-file -F "file=@sample.cdr" (in case anyone is too lazy to install postman or extension in vscode)
