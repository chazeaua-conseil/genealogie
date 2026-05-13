# Généalogie Chazeau

Application web familiale pour gérer plusieurs arbres généalogiques.

Voir [PLAN.md](./PLAN.md) pour la vision complète, les décisions techniques et l'état d'avancement.

## Stack

- **Next.js 16** (App Router) + TypeScript + Turbopack
- **Tailwind v4** + **shadcn/ui**
- **Prisma 7** + driver adapter `@prisma/adapter-pg`
- **PostgreSQL 16**
- **Auth.js v5** + provider Google + adapter Prisma
- **Docker Compose** + **Traefik** (reverse proxy partagé en prod)

## Développement local

Pré-requis : Node 22+, Docker (pour Postgres en local), un OAuth Client Google.

```bash
# 1. Copier et configurer les variables d'environnement
cp .env.example .env
# Remplir DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# 2. Lancer Postgres en local (à venir : docker-compose.dev.yml)
# Pour l'instant : docker run -d --name genealogie-db -p 5432:5432 \
#   -e POSTGRES_DB=genealogie -e POSTGRES_USER=genealogie \
#   -e POSTGRES_PASSWORD=devpassword postgres:16-alpine

# 3. Appliquer le schéma
npx prisma migrate dev

# 4. Lancer le serveur de dev
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000).

## Déploiement

Cible : VPS Hostinger (Ubuntu 24.04), intégration dans la stack Traefik existante.

URL de production : [https://chazeau-genealogie.fr](https://chazeau-genealogie.fr)

Détails du plan de déploiement dans [PLAN.md](./PLAN.md).

## Sécurité — repo public

Ce repo est public. Les données généalogiques (arbres, personnes, photos) vivent
**uniquement dans la base Postgres** sur le VPS — jamais dans le code.

Ne jamais commiter :
- Le fichier `.env` (gitignored)
- Des dumps de la base de données
- Des exports CSV de recherches familiales
- Des médias personnels (photos d'actes, scans…)
