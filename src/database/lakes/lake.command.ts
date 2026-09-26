
import { Injectable } from "../../../container";
import { LakesFilesService } from "./lakesFiles.service";
import { MigrationService } from "./migration.service";

@Injectable()
export class LakesCtlFacade 
{
    constructor( 
        protected migrationService : MigrationService,
        protected lakesFilesService:  LakesFilesService
    ){}

    async migrationInit(){
        await this.migrationService.initialize();
        console.log('Migration system initialized');
        await this.migrationService.close();
    }

    async migrationStatus()
    {
        await this.migrationService.initialize();

        const status = await this.migrationService.status();

        console.log('\nExecuted migrations:');
        status.executed.forEach((name) => console.log(`  [x] ${name}`));

        console.log('\nPending migrations:');
        status.pending.forEach((name) => console.log(`  [ ] ${name}`));

        await this.migrationService.close();
    }

    async migrationUp(options: { steps?: number } = {}){

        //
        await this.migrationService.initialize();
        
        const results = await this.migrationService.up(options);
        
        console.log('\nMigration summary:');
            results.forEach((r) => {
              console.log(`  ${r.status === 'success' ? 'OK' : 'FAIL'} ${r.name} (${r.duration}ms)`);
        });
        
        await this.migrationService.close();
    }

    
    async migrationDown(options: { steps?: number } = {}){
        await this.migrationService.initialize();
        
        const results = await this.migrationService.down(options);
        
        console.log('\nRollback summary:');
            results.forEach((r) => {
              console.log(`  ${r.status === 'success' ? 'OK' : 'FAIL'} ${r.name} (${r.duration}ms)`);
        });
        
        await this.migrationService.close();
    }

    async createTableFiles(tableName :string)
    {
        // create the table files
        this.lakesFilesService.createTableFiles(tableName);

    }

    async deleteTableFiles(tableName :string)
    {
        // create the table files
        this.lakesFilesService.deteleTableFiles(tableName);

    }
}
