[![Build Status](https://drone.midgar.io/api/badges/Midgar/migrate/status.svg)](https://drone.midgar.io/Midgar/migrate)
[![Coverage](https://sonar.midgar.io/api/project_badges/measure?project=midgar-migrate&metric=coverage)](https://sonar.midgar.io/dashboard?id=midgar-migrate)


## @midgar/migrate

Système de migration pour [Midgar](https://github.com/midgarjs/midgar)

## Installation

```sh
$ npm i @midgar/migrate
```
Si tout s'est bien passé, un message de confirmation s'affiche:

```sh
#midgar-cli
@midgar/migrate added to plugins.json !
```

## Fonctionnement
Ajoute les types de modules **midgar-migrate-schema** dans le dossier ./migrations/schemas et **midgar-migrate-data**,./migrations/data.

Les migration **data** sont exéctuté apres les **schema**.
Ce plugin à besoin d'un storage pour fonctionner. Le storage sert a sauvegarder de facon permanante l'état des migrations.

## module migration

Exemple de module de migration:
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
/**
 * @typedef {Object} Migration
 * @property {string} plugin Plugin name
 * @property {string} name   Migration file name
 * @property {string} type   Migration type (schema|data)
 */


class Storage {
  constructor (mid) {
    this.mid = mid
  }

  /**
   * @return {<Promis<boolean>>}
   */
  async isInstalled () {
    return true
  }

  /**
   * @return {<Promis<Array<Mirgration>>>}
   */
  async getMigrations () {
    return []
  }

  /**
   * Save executed migration
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Migration file name
   * @param {string} type   Migration type (schema|data)
   *
   * @return {Promise<void>}
   */
  async saveMigration (plugin, name, type) {}

  /**
   * Delete executed migration
   *
   * @param {string} plugin Plugin name
   * @param {string} name   Migration file name
   * @param {string} type   Migration type (schema|data)
   * 
   * @return {Promise<void>}
   */
  async deleteMigration (plugin, name, type) {}

  /**
   * Retrun migation function args after midgar instance 
   * 
   * @return {Array<any>}
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

[documentation Api](https://midgarjs.github.io/migrate/).