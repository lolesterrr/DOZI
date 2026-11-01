import fs from 'fs';
const out = {};
for (const n of process.argv.slice(2)) {
  const src = fs.readFileSync(`${new URL('../../../node_modules', import.meta.url).pathname}/lucide-react-native/dist/esm/icons/${n}.mjs`, 'utf8');
  const obj = src.match(/const __iconData = (\{[\s\S]*?\n\});/)[1];
  const data = Function(`return (${obj});`)();
  out[n] = data.node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
}
fs.writeFileSync(process.env.OUT, JSON.stringify(out));
