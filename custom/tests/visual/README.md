# Capturas sintéticas no Firefox

Execute a partir da raiz do clone isolado da v0.19.0, com as dependências frontend já instaladas e Firefox disponível no PATH. Os servidores de teste e Marionette escutam apenas em loopback. O adaptador HTTP da fixture fornece os dados e evita consultas à instalação existente.

```sh
mkdir -p tmp/validation/reference frontend/tmp/securo-visual
git archive v0.16.6-custom.6 frontend | tar -x -C tmp/validation/reference
mkdir -p tmp/validation/reference/frontend/tmp/securo-visual
cp custom/tests/visual/{check.tsx,index.html,vite.config.ts} frontend/tmp/securo-visual/
cp custom/tests/visual/{check.tsx,index.html,vite.config.ts} tmp/validation/reference/frontend/tmp/securo-visual/
ln -s "$PWD/frontend/node_modules" tmp/validation/reference/frontend/node_modules
python3 custom/tests/visual/visual-check.py
```

As imagens são gravadas em `tmp/validation/capturas`. Para substituir as capturas existentes, passe `v019 v016-custom replace` ao script. As dimensões efetivas são registradas no console. No ambiente Fedora usado na migração, o Firefox impôs largura mínima de 500 px no modo headless.
