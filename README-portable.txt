Image Studio Portable Guide

Recommended portable layout:

  ImageStudioPortable\
    app\                 this project folder contents
    node\                optional portable Node.js folder
    start-portable.bat
    stop-portable.bat

Quick use on a computer that already has Node.js:

  1. Copy this whole folder to your removable drive.
  2. Open .env.local and confirm VISIONARY_API_KEY is filled.
  3. Double-click start-portable.bat.
  4. Open http://127.0.0.1:3000 if the browser did not open automatically.

Optional fully portable Node.js:

  1. Download the Windows x64 Node.js zip from https://nodejs.org/.
  2. Extract it into a folder named node next to start-portable.bat.
  3. Make sure node\node.exe and node\npm.cmd exist.
  4. Double-click start-portable.bat.

Data locations:

  prisma\dev.db                         SQLite history database
  public\generated\YYYY\MM\DD\         generated images
  public\references\YYYY\MM\DD\        reference images
  .env.local                            Visionary API key

Portability notes:

  - The app now stores image file paths relative to the project folder.
  - It can be moved between D:, E:, F:, etc. without breaking history images.
  - Keep node_modules with the folder if you want to avoid reinstalling dependencies.
  - If dependencies are missing, run npm install once in this folder.

Stop server:

  Double-click stop-portable.bat.

Repair old absolute paths after moving drives:

  node scripts\migrate-portable-paths.mjs
