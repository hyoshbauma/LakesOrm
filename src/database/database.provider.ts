import { LakesServiceProvider } from "./lakes/lakes.provider";
import { LakesCtlFacade } from "./lakes/lake.command";


// 
// @Singleton
export class DatabaseServiceProvider extends LakesServiceProvider
{

  constructor(){
    super();

    // Database Service Provider Initialization
    // Register an on-demand generation factory function
    this.register([
      LakesCtlFacade, 
    ]);
    
  }
  // App Initialization
  // getServiceOf(){
  //   return this.get(DatabaseService);
  // }



}