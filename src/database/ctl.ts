import { Command } from 'commander';
import { LakesCtlFacade } from './lakes/lake.command';




export function lakesOrmCtl (lakesClt : LakesCtlFacade){

const program = new Command();

program
  .name('lakes')
  .description('Database migration tool')
  .version('1.0.0');



program
  .command('table')
  .description('Create or delete table files')
  .option('-c, --create <name>', 'Create Table Files (TableClass & Migration)')
  .option('-d, --delete <name>', 'Delete Table Files (TableClass & Migration)')
  .action(async (options) => {
    
    if(options.create) await lakesClt.createTableFiles(options.create) ;

    if(options.delete) await lakesClt.deleteTableFiles(options.delete);

  });

program
  .command('migrate')
  .description('Run pending migrations')
  .option('-i, --init', 'Initialize migration system')
  .option('-s, --status', 'Show migration status')
  .option('-u, --up', 'Migrations to run')
  .option('-d, --down', 'Migrations to rollback')
  .action(async (options) => {
    
    if(options.init) await lakesClt.migrationInit() ;

    if(options.status) await lakesClt.migrationStatus();

    if(options.up) await lakesClt.migrationUp();

    if(options.down) await lakesClt.migrationDown();

  });



program.parseAsync().catch((error) => {
  console.error(error);
  // exit now: after a failure the pool can still hold idle clients, which keep the process alive
  process.exit(1);
});

}