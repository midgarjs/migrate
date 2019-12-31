![](https://ci.midgar.io/app/rest/builds/buildType:(id:Midgar_Migrate_Build)/statusIcon) [![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=Midgar_Migrate&metric=coverage)](https://sonar.midgar.io/dashboard?id=Midgar_Migrate)

## @midgar/migrate

Système de migration pour [Midgar](https://www.npmjs.com/package/@midgar/midgar)

## Installation

```sh
$ npm i @midgar/migrate --save
```
Si tout s'est bien passé, un message de confirmation s'affiche:

```sh
#midgar-cli
@midgar/migrate added to plugins.js !
```

## Fonctionnement
Ajoute un dossier de plugin **midgar-migrate-schemas**: ./migrations/schemas et **midgar-migrate-data**: ./migrations/data'

## Commandes cli

### Up
Exéctute up sur toutes les migrations en attente:
```sh
$ midgar migrate:up
```

Exéctute up sur les 3 premières migrations en attente:
```sh
$ midgar migrate:up 3
```

### Down
Exéctute down sur toutes les migrations en executé:
```sh
$ midgar migrate:down
```

Exéctute down sur les 3 denière migrations en executé:
```sh
$ midgar migrate:down 3
```

### Status
Affiche le nombre et la liste de migration en attente d'exécutions:
```sh
$ midgar migrate:down
```

### Paramètre optionnels

--config chemin vers le dossier de configuration du projet:
```sh
$ midgar migrate:up --config ~/mon-project/src/config
```

--storage clef du storage:
```sh
$ midgar migrate:up --storage mongo
```