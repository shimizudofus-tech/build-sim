# Serveur de test local

Pour tester **XP**, **énergie (30/30)**, auth test et API sans toucher la base prod.

## Démarrage

```bash
npm run test:server
```

Ou double-clic : `tools/test-server.bat`

- **Site** : http://localhost:8770/ (port par défaut, évite le conflit avec `npm start` sur 8765)
- **Panneau test** : http://localhost:8770/test/

## Config

1. Copie `.env.test.example` → `.env.test` (optionnel)
2. La base de test est `data/db.test.json` (séparée de `data/db.json`)

## Connexion test

Sur http://localhost:8770/test/ → bouton **Connexion test**  
Crée le compte `test:local` avec énergie **30/30** et **0 XP**.

## Endpoints (mode test uniquement)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/test/info` | Infos mode test |
| POST | `/api/auth/test-login` | Session test |
| GET | `/api/profile/progress` | Lire XP / énergie |
| POST | `/api/profile/progress/xp` | Ajouter XP (`source`: `test` ou `minigame`) |
| POST | `/api/test/progress/reset` | Reset 30/30 + 0 XP |
| POST | `/api/test/spend-energy` | Dépenser de l’énergie (`{ "cost": 5 }`) |

Le site principal garde l’aperçu statique **Coming soon** ; le panneau `/test/` utilise l’API live.
