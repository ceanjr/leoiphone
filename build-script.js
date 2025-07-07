const fs = require('fs');
const path = require('path');

// O nome da sua variável de ambiente na Vercel
const adminToken = process.env.ADMIN_TOKEN || "050990"; // Fallback para desenvolvimento local

const scriptPath = path.join(__dirname, 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Substitua a linha onde o adminToken é definido no seu script.js
// Mude: const adminToken = "050990";
// Para: const adminToken = "##ADMIN_TOKEN_PLACEHOLDER##"; temporariamente no seu script.js
// E este script irá preencher.

// A linha abaixo busca a definição literal do token no seu script e a substitui.
// Adapte o regex caso a sua linha seja diferente.
// Ex: const adminToken = "050990";
// Será substituída por: const adminToken = "o valor da variavel de ambiente";
scriptContent = scriptContent.replace(/const adminToken = ".*";/, `const adminToken = "${adminToken}";`);

// Opcional: Se você quer que o firebaseConfig.apiKey também venha de uma variável de ambiente Vercel
const firebaseApiKey = process.env.FIREBASE_API_KEY || "AIzaSyDrw18otUXUzzKPR2Q_jxAE2NqrvL4gj9I";
scriptContent = scriptContent.replace(/apiKey: ".*",/, `apiKey: "${firebaseApiKey}",`);


const outputPath = path.join(__dirname, 'dist', 'script.js'); // Onde seu script final será salvo
const outputHtmlPath = path.join(__dirname, 'dist', 'index.html'); // Onde seu HTML final será salvo

// Crie a pasta 'dist' se ela não existir
if (!fs.existsSync(path.join(__dirname, 'dist'))){
    fs.mkdirSync(path.join(__dirname, 'dist'));
}

fs.writeFileSync(outputPath, scriptContent);
console.log(`script.js built with ADMIN_TOKEN: ${adminToken}`);

// Copie os outros arquivos (HTML, CSS, imagens) para a pasta 'dist'
fs.copyFileSync(path.join(__dirname, 'index.html'), outputHtmlPath);
fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(__dirname, 'dist', 'style.css'));
// E para imagens, pode ser necessário copiar a pasta inteira ou ajustar o HTML
// para que as imagens apontem para a pasta img na raiz do deploy.
// Para uma abordagem mais robusta, considere uma ferramenta de build como Webpack ou Parcel.
console.log("HTML and CSS copied to dist/");