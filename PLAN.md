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

## État scaffold (2026-05-14)

- ✅ **Next.js 16.2.6** scaffold (App Router, TS, Tailwind v4, Turbopack)
- ✅ **shadcn/ui** initialisé (preset base-nova)
- ✅ **Prisma 7.8** + `@prisma/adapter-pg` (pg driver) — schema.prisma complet
- ✅ **Auth.js v5** + Google provider + adapter Prisma + ALLOWED_EMAILS
- ✅ **Page d'accueil** avec sign-in / sign-out via Server Actions
- ✅ **Dockerfile** multi-stage (Node 22 alpine, standalone output)
- ✅ **docker-compose.yml** production avec labels Traefik (`mytlschallenge`, redirect www, n8n_default external)
- ✅ **`.env.example`** documenté, `.env` local généré, `.gitignore` couvre `.env*` + `lib/generated/`
- ✅ **`next build`** validé OK
- ✅ **Initial commit pushé** sur [chazeaua-conseil/genealogie](https://github.com/chazeaua-conseil/genealogie)

## Prochaines actions (dans l'ordre)

1. **Créer l'OAuth Client Google** (manuel, navigateur) :
   - Google Cloud Console → "OAuth client ID" type Web application
   - Authorized redirect URIs :
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://chazeau-genealogie.fr/api/auth/callback/google` (prod)
   - OAuth consent screen : External, Testing mode, ajouter les emails autorisés dans "Test users"
   - Récupérer `AUTH_GOOGLE_ID` et `AUTH_GOOGLE_SECRET`
2. **Dev local** (Postgres en Docker sur le Mac, migration, premier sign-in)
3. **Déploiement VPS** :
   - `git pull` dans `/docker/genealogie/` sur le VPS (à initialiser)
   - Créer `/docker/genealogie/.env` avec les vraies valeurs (POSTGRES_PASSWORD, AUTH_*, DATABASE_URL, ALLOWED_EMAILS, AUTH_URL=https://chazeau-genealogie.fr)
   - `docker compose build && docker compose up -d db`
   - `docker compose run --rm app npx prisma migrate deploy`
   - `docker compose up -d`
   - Vérifier HTTPS sur `https://chazeau-genealogie.fr` (Traefik génère le cert)
4. **Sauvegardes** pg_dump cron + offsite (Backblaze B2 ou autre)
5. **Phase 1** : pages CRUD personnes/familles/événements + import CSV

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
