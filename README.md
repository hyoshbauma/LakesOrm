# Lakes ORM

LakesORM is a modern Object-Relational Mapper (ORM) built specifically for TypeScript (Bun) developers, designed to simplify PostgreSQL database interactions. Currently in the Staging phase, version 0.1.48 is an actively developed release, focusing on robust data modelling and type safety for complex applications.

---

## Tech Stack

| Layers | Technology |
|---|---|
| Node | Version 22, NPM version 11.19.0 |
| Database | PostgreSQL 18 or higher  |



## Quick Start

You need a Local NPM registry, this documentation is using verdaccio

| verdaccio can be installed in 2 ways : |
|---|---|---|
| NPM | `Install Globally via npm`|  
| Docker| `Run a docker container` | 


```bash
# 1. Install dependencies
bun install

# 2. To build the npm package:
bun run build

# skip step 3 if you have a local or online NPM registry
# then update step 7 correctly


# 3.1 Install Globally via npm (Local NPM registry)
npm install -g verdaccio

# 3.2 Launch the local registry by running:
verdaccio

# By default, the server will start running at http://localhost:4873

# 3.3 Point npm to your Local Registry
npm config set registry http://localhost:4873/

# Alternatively, create a .npmrc file inside a specific project root and add registry=http://localhost:4873/ to isolate its use


# 3.4 To publish packages, create a user profile in your local instance:
npm adduser --registry http://localhost:4873/

# 4. Run npm publish inside LakesORM directory.
npm publish


# 5. create a new burn project
bun create hono@latest my-app

# 6. cd the project you have create
cd my-app

# 7. Install the npm dependancy from verdaccio
bun add  @blm/lakeorm

```

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Set connection to Postgres |

Full variable reference: [.env.example](.env.example)


## Folders and Files Command Setup

Before runing any commands, please add this to your

```bash
# Then add the dev command to your existing package.json.
{
  "scripts": {
    "dev": "lakes": "bun run ./src/database/lakes/ctl.ts"
    }
}


# Create  these folders and inside them create the file named ctl.ts
./
└── src/
    └── database/
        └── lakes/
            └── ctl.ts


# please copy this in the ctl.ts file

#. All migration files and Repository files will be in lakes directory, migration direction and tables directory respectively

```

To initialize the command layer, you need to configure the Lakecopy the code below in the ctl.ts file


```typescript
import { LakesCtlFacade, LakesServiceProvider, lakesOrmCtl } from '@blm/lakeorm';

// Instantiate the ORM Provider
const lakesProvider = new LakesServiceProvider();

// Get the LakeCtlFacade
const lakesClt: LakesCtlFacade = lakesProvider.getLakesCtlOf();

// Import the ORM commands
const OrmCtl = lakesOrmCtl(lakesClt);

```

## Key Commands

```bash
# Help commands
bun run lakes --help

# create a table's Repository, table's interface in one file and the migration file
bun run lakes table --create User

# or 
bun run lakes table -c User

# delete a table's Repository, table's interface in one file and the migration file
bun run lakes table --delete User

# or short format
bun run lakes table -d User

# Run the migration up to the Database
bun run lakes migrate --up

# or short format
bun run lakes migrate -u

# Run the migration down to the Database
bun run lakes migrate --down

# or short format
bun run lakes migrate -d

```

## Some codes

This just a example of migration (part of it actualy)

```typescript

    // Run your schema changes here
    public async up(): Promise<User | null> {
          
        return new UserTable().createTable()
            .addColumn('id', 'SERIAL', { primaryKey: true })  // default comes with the migration file
            .addColumn('firstName', 'TEXT') // to be se by you
            .addColumn('lastName', 'TEXT')  // to be se by you
            .addColumn('telephone', 'TEXT', {unique: true, nullable: false})  // to be se by you
            .addColumn('createdAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'}) // default comes with the migration file
            .addColumn('updatedAt', 'TIMESTAMP WITH TIME ZONE', {defaultFn: 'NOW()'}) // default comes with the migration file
            .save();
    }
```

