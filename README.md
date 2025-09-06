# King of Carts – Telegram Bot

Backend Telegram game in Node.js + TypeScript. Designed for VPS deployment without Docker.

## Requisiti
- Node.js 20 LTS (versioni successive non supportate)
- SQLite3 installato sul sistema

## Setup
```bash
cp .env.example .env
# modifica le variabili
npm install # compila automaticamente TypeScript
npm run migrate
npm run start
```

## Webhook
Per registrare il webhook (se `PUBLIC_BASE_URL` e `WEBHOOK_PATH_SECRET` sono valorizzati):
```bash
npm run set:webhook
```
Per rimuoverlo:
```bash
npm run del:webhook
```

## Test rapido
```bash
curl -f https://bot.tuodominio.tld/healthz
```

## Production
### pm2
```bash
pm2 start npm --name kingofcarts -- run start
```
### systemd
```
[Unit]
Description=King of Carts Bot
After=network.target

[Service]
Type=simple
WorkingDirectory=/percorso/kingofcarts_story
ExecStart=/usr/bin/node dist/index.js
Restart=always
EnvironmentFile=/percorso/kingofcarts_story/.env

[Install]
WantedBy=multi-user.target
```

## Sicurezza
- Ruota periodicamente i segreti nell'env.
- Limita le richieste e applica backup regolari del DB SQLite.

