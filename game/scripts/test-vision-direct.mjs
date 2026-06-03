import fs from 'fs';
import 'dotenv/config';
import { VISION_IDENTIFY_PROMPT } from '../lib/prompts.js';

const { NVIDIA_API_KEY, NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1', VISION_MODEL = 'meta/llama-3.2-90b-vision-instruct' } = process.env;

const imgPath = 'C:/Users/goenk/.cursor/projects/c-Users-goenk-Desktop-go-f-yourself/assets/c__Users_goenk_AppData_Roaming_Cursor_User_workspaceStorage_cd60addbadbd7a4a87b5e361d3c18abd_images_Old_Monk-ddfe65e2-81ae-4d16-8572-bb0488d19128.png';
const buf = fs.readFileSync(imgPath);
const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;

const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${NVIDIA_API_KEY}`,
  },
  body: JSON.stringify({
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: VISION_IDENTIFY_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Identify this drink. Respond with ONLY the JSON object described in your instructions.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 420,
  }),
});

console.log('Status:', res.status);
const data = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}
console.log(data?.choices?.[0]?.message?.content);
