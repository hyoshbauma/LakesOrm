import { Command } from 'commander';
import { LakesCtlFacade } from './lakes/lake.command';
import { LakesServiceProvider } from './lakes/lakes.provider';


const lakesProvider = new LakesServiceProvider();

const lakesClt : LakesCtlFacade = lakesProvider.getLakesCtlOf();


export function lakesOrmCtl (lakesClt : LakesCtlFacade){

const program = new Command();

program
  .name('lakes')
  .description('Database migration tool')
  .version('1.0.0');



program
  .command('table')
  .description('Run pending migrations')
  .option('-c, --create <name>', 'Create Table Files (TableClass & Migration)')
  .option('-d, --delete <name>', 'Create Table Files (TableClass & Migration)')
  .action(async (options) => {
    
    if(options.create) await lakesClt.createTableFiles(options.create) ;

    if(options.delete) await lakesClt.deleteTableFiles(options.delete);

  });

program
  .command('migrate')
  .description('Run pending migrations')
  .option('-i, --init', 'Initialize migration system')
  .option('-s, --status', 'Show migration status')
  .option('-u, --up ', 'Migrations to run')
  .option('-d, --down', 'Migrations to rollback')
  .action(async (options) => {
    
    if(options.init) lakesClt.migrationInit() ;

    if(options.status) await lakesClt.migrationStatus();

    if(options.up || options.upt) await lakesClt.migrationUp();

    if(options.down) await lakesClt.migrationDown();

  });



program.parse();

}