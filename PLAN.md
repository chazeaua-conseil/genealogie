# Projet généalogie — Plan & état d'avancement

## Vision

Application web de généalogie collaborative pour gérer plusieurs arbres familiaux,
administrée à 2 (utilisateur + son père). UX moderne adaptée à la saisie et la
visualisation de recherches généalogiques déjà effectuées.

- Volume cible : ~2 000 personnes max
- Données source : tableurs / PowerPoint (pas de GEDCOM existant)
- Hébergement : VPS Hostinger Ubuntu 24.04 (4 Go RAM / 50 Go disque / 1 CPU)
- Domaine : `chazeau-genealogie.fr`
- Repo GitHub : `chazeaua-conseil/genealogie` (public — pas de secrets commités)

## Décisions techniques

| Sujet | Choix | Raison |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | SSR, écosystème React Flow / D3 pour viz arbre |
| UI | Tailwind + shadcn/ui | Composants modifiables, pas de lock-in |
| ORM | Prisma | DX rapide ; SQL brut pour requêtes récursives en Phase 2 |
| DB | Postgres 16 (`postgres:16-alpine`) | CTE récursives pour lignées |
| Auth | Auth.js + Google OAuth provider | Père a Gmail, zéro mot de passe à gérer |
| Reverse proxy | Traefik existant (pas Caddy) | Déjà déployé sur le VPS pour n8n + randocool |
| Email | (à décider — pas nécessaire vu Google OAuth) | — |
| Sauvegardes | pg_dump cron + offsite (B2 ou autre) | À mettre en place Phase 0.5 |

## État VPS — durcissement terminé (2026-05-11)

- ✅ Utilisateur non-root `achazeau` créé, dans groupes `sudo` + `docker`
- ✅ SSH key-only via `/etc/ssh/sshd_config.d/01-hardening.conf` :
  - `PasswordAuthentication no`
  - `PermitRootLogin no`
  - `PubkeyAuthentication yes`
  - `KbdInteractiveAuthentication no`
- ✅ UFW actif : SSH (22) / HTTP (80) / HTTPS (443) en allow incoming, deny par défaut
- ✅ fail2ban actif, jail `sshd` (bantime 1h, maxretry 5, backend systemd)
- ✅ Swap 2 Go (`/swapfile`) persisté dans `/etc/fstab`, swappiness=10
- ✅ Docker 29.3.0 + Compose v5.1.1 installés (déjà présents avant)

## Infra Docker existante sur le VPS

Stack déployée dans `/docker/n8n/docker-compose.yml`. Containers actifs :

- `n8n-traefik-1` (Traefik) — reverse proxy sur 80/443
- `n8n-n8n-1` (n8n) — workflows, exposé `127.0.0.1:5678`
- `n8n-randocool-1` (nginx:alpine) — sert le site `randocool.fr`

Réseau Docker partagé : **`n8n_default`** (créé implicitement par compose).
Resolver TLS Traefik : **`mytlschallenge`** (ACME tlsChallenge).
Certificats stockés dans volume `traefik_data:/letsencrypt/acme.json`.

L'API Traefik est en `--api.insecure=true` mais pas exposée publiquement (port 8080
non publié). Pas urgent à fixer mais à garder à l'esprit.

## Plan d'intégration de l'app généalogie

Compose séparé `/docker/genealogie/docker-compose.yml` :

```yaml
services:
  app:      # Next.js, port interne 3000
    networks: [n8n_default, internal]
    labels:
      - traefik.enable=true
      - traefik.http.routers.genealogie.rule=Host(`chazeau-genealogie.fr`)
      - traefik.http.routers.genealogie.entrypoints=web,websecure
      - traefik.http.routers.genealogie.tls=true
      - traefik.http.routers.genealogie.tls.certresolver=mytlschallenge
      - traefik.http.services.genealogie.loadbalancer.server.port=3000
      # + redirect www → root (cf. pattern randocool)

  db:       # Postgres 16
    networks: [internal]    # isolé, pas accessible hors compose
    volumes: [db_data:/var/lib/postgresql/data]

networks:
  n8n_default: { external: true }
  internal:    { driver: bridge }

volumes:
  db_data:
```

## Modèle de données (schéma initial)

Entités à scaffolder en Prisma :

- **`tree`** : espace de travail, multi-tenants à 2 utilisateurs
- **`user`** : utilisateurs (gérés par Auth.js avec adapter Prisma)
- **`person`** : individus (nom, prénom, sexe, notes — pas de date/lieu directement)
- **`event`** : naissance, décès, mariage… typé, daté (avec incertitude "vers/avant/après"), lieu, lié à 1 ou N personnes
- **`family`** : unité d'union (2 partenaires), rattache enfants et événements de couple
- **`relationship`** : lien parent-enfant typé (biologique / adoptif / reconnu)
- **`source`** + **`citation`** : actes, registres, etc.
- **`place`** : lieux normalisés (commune, département, pays, lat/lng optionnels)
- **`media`** : photos / scans rattachés à personnes / événements / sources

Subtilités à gérer dès le départ :
- Incertitude des dates (qualifier : exact / vers / avant / après / entre)
- Versionning des modifications (qui a changé quoi)
- Historique des noms de lieux (commune ayant changé de département)

## Phasage

- ✅ **Phase 0** : setup VPS, hardening, repo, DNS — quasi terminé (manque scaffold)
- **Phase 1** (1–2 sem) : auth Google OAuth + CRUD personnes/familles/événements + fiche personne éditable + liste/recherche + **import CSV** (vu que données source en tableur)
- **Phase 2** (1 sem) : viz pedigree ascendant en SVG + ajout rapide en contexte (parent/enfant/conjoint depuis fiche)
- **Phase 3** (1 sem) : sources/citations + média + sauvegardes automatisées
- **Phase 4** (optionnel) : import/export GEDCOM, gazetteer de lieux, timeline transversale

## État (2026-05-14) — App déployée et opérationnelle

- ✅ **Next.js 16.2.6** scaffold (App Router, TS, Tailwind v4, Turbopack)
- ✅ **shadcn/ui** initialisé (preset base-nova)
- ✅ **Prisma 7.8** + `@prisma/adapter-pg` — schema complet, migration `init` appliquée
- ✅ **Auth.js v5** + Google provider + adapter Prisma + ALLOWED_EMAILS (vide en prod, à régler)
- ✅ **Dockerfile** multi-stage (Node 22 alpine, output: standalone)
- ✅ **docker-compose.yml** prod avec 3 services :
  - `app` (target=runner) — l'app Next.js, branchée sur `n8n_default` et `internal`
  - `db` (postgres:16-alpine) — isolé sur `internal` uniquement
  - `migrator` (target=builder, profile=migrate) — one-shot pour `prisma migrate deploy`
- ✅ **Premier déploiement OK** :
  - https://chazeau-genealogie.fr répond 200 (HTTP/2)
  - Cert Let's Encrypt valide (R12, jusqu'au 11 août 2026)
  - Sign-in Google fonctionnel end-to-end (testé en local et en prod)
  - DB Postgres avec toutes les tables, vide
- ✅ **Sauvegardes** : `scripts/backup.sh` + cron quotidien 03:17 UTC, rotation 30 jours

## Points d'attention découverts pendant le déploiement

- **Système nginx Hostinger** : a démarré tout seul le 2026-05-12 et a pris le port 80, bloquant Traefik silencieusement. Désactivé via `systemctl mask nginx`. Si un autre service système prend 80/443 après un reboot Hostinger, refaire pareil. À vérifier après chaque reboot du VPS.
- **Prisma 7 breaking change** : `datasource db { url = env(...) }` n'est plus supporté dans `schema.prisma` — la connection URL passe par `prisma.config.ts`.
- **Migrations en Docker** : le standalone Next.js ne trace pas les deps de la CLI Prisma. Solution : service `migrator` séparé qui utilise le stage `builder` complet (déjà avec full node_modules).

## Procédures opérationnelles

### Déploiement d'un changement applicatif

```bash
# Local: commit + push (depuis Mac, /Volumes/Extreme SSD/genealogie)
git push

# VPS:
ssh achazeau@187.77.163.66
cd ~/genealogie
git pull
docker compose build app
docker compose up -d --no-deps app
```

### Déploiement avec changement de schéma DB

```bash
# Sur le VPS:
cd ~/genealogie
git pull
docker compose --profile migrate build migrator
docker compose --profile migrate run --rm migrator   # applique les migrations
docker compose build app
docker compose up -d --no-deps app
```

### Restauration d'un backup

```bash
ssh achazeau@187.77.163.66
cd ~/genealogie
gunzip -c ~/genealogie-backups/genealogie-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose exec -T db psql -U genealogie -d genealogie
```

## Prochaines actions

1. **Verrouiller `ALLOWED_EMAILS` en prod** : éditer `/home/achazeau/genealogie/.env` pour mettre la liste des Gmail autorisés (ton email + celui de ton père), puis `docker compose up -d --no-deps app`. Aujourd'hui Google Cloud "Testing mode" est la seule barrière.
2. **Offsite backup** (à mettre en place) : actuellement les dumps vivent uniquement sur le VPS. Si le VPS meurt, on perd tout. Options : Backblaze B2 + rclone (10 Go gratuits), rsync vers le Mac/SSD externe, ou autre cloud. À acter.
3. **Phase 1 — CRUD applicatif** :
   - Création/listing/édition d'arbres et de membres (TreeMember)
   - Page personne éditable inline (nom, événements, relations)
   - Liste/recherche de personnes avec filtres (nom, période, lieu)
   - Import CSV (les données source sont en tableur)
4. **Phase 2** : viz pedigree ascendant en SVG + ajout rapide en contexte
5. **Phase 3** : sources/citations + média
6. **Phase 4** (optionnel) : import/export GEDCOM, gazetteer de lieux

## Identifiants et URLs

- App : https://chazeau-genealogie.fr
- Repo : https://github.com/chazeaua-conseil/genealogie
- VPS : `ssh achazeau@187.77.163.66`
- Compose : `/home/achazeau/genealogie/docker-compose.yml`
- Backups : `/home/achazeau/genealogie-backups/`

## Filets de sécurité & rappels

- Console navigateur Hostinger disponible en cas de lockout SSH
- Backup config sshd : `/etc/ssh/sshd_config.bak.20260511` (sur VPS)
- Repo public → JAMAIS commiter `.env`, dumps DB, exports CSV de données familiales
- Les données généalogiques vivent dans Postgres uniquement, jamais dans le repo

## VPS — infos pratiques

- IP : `187.77.163.66`
- Connexion : `ssh achazeau@187.77.163.66` (clé Ed25519 du Mac, alias possible à créer dans `~/.ssh/config`)
- Sudo : password achazeau (jamais le root, qui est désactivé pour SSH)
- Mot de passe root et root SSH = désactivés (clé only, et root login interdit)
