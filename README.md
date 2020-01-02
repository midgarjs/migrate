[![Build Status](https://drone.midgar.io/api/badges/Midgar/migrate/status.svg)](https://drone.midgar.io/Midgar/migrate)
[![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=Midgar%3Amigrate&metric=coverage)](https://sonar.midgar.io/dashboard?id=Midgar%3Amigrate)


## @midgar/migrate

Système de migration pour [Midgar](https://github.com/midgarjs/midgar)

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

Ce plugin à besoin d'un storage pour fonctionner. Le storage sert a sauvegarder l'état des migrations.

## Fichier migration

Exemple de fichier de migration:
```js
export default {
  up: async (mid, ...storageArgs) => {
    // Up script
  },
  down: async (mid, ...storageArgs) => {
    // Down script
  }
}

```

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

## Storages

Exemple de storage:
```js
class Storage {
  constructor (mid) {
    this.mid = mid
  }

  async isInstalled () {
    return true
  }

  async getMigrations () {
    return []
  }

  /**
   * Save executed migration
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Migration file name
   * @param {string} type   Migration type (schema|data)
   */
  async saveMigration (plugin, name, type) {
  }

  /**
   * Delete executed migration
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Migration file name
   * @param {string} type   Migration type (schema|data)
   */
  async deleteMigration (plugin, name, type) {
  }

  /**
   * Retrun migation function args after midgar instance 
   */
  getCallArgs () {
    return []
  }
}

export default Storage
```

## Ajouter le storate

Depuis la méthode init du plugin:

```js
import Storage from './libs/migrate-storage.js'
...
this.mid.on('@midgar/migrate:init', (migrateService) => {
  migrateService.addStorage('monstorage', Storage)
})
```