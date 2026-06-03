import fs from 'fs';
import 'dotenv/config';

const imgPath = process.argv[2] || 'C:/Users/goenk/.cursor/projects/c-Users-goenk-Desktop-go-f-yourself/assets/c__Users_goenk_AppData_Roaming_Cursor_User_workspaceStorage_cd60addbadbd7a4a87b5e361d3c18abd_images_Old_Monk-ddfe65e2-81ae-4d16-8572-bb0488d19128.png';
const buf = fs.readFileSync(imgPath);
const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;
console.log('Image KB:', Math.round(buf.length / 1024));

const r = await fetch('http://localhost:3000/api/detect-drink', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: dataUrl }),
});
const j = await r.json();
console.log(JSON.stringify(j, null, 2));
