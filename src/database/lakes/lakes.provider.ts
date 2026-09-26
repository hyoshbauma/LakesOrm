import { Container, Injectable, Singleton } from "../../../container";
import { ToolLakesService } from "./tools/tools.service";
import { MigrationService } from "./migration.service";
import { MigrationTemplateService } from "./templates/migration.template";
import { TableTemplateService } from "./templates/table.template";
import { LakesFilesService } from "./lakesFiles.service";
import { LakesCtlFacade } from "./lake.command";

// 
@Injectable()
export class LakesServiceProvider extends Container
{

  constructor(){
    super();

    // Lakes Service Provider Initialization
    // Register an on-demand generation factory function
    this.register([
      ToolLakesService, 
      TableTemplateService, 
      MigrationTemplateService,
      MigrationService,
      LakesFilesService,
      LakesCtlFacade
    ]);
    
  }

  /**
   * GET the Migration 
   * */
  getMigration(){
    return this.get(MigrationService);
  }

  getLakesCtlOf(){
    return this.get(LakesCtlFacade);
  }


}