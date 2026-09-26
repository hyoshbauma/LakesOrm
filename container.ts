import 'reflect-metadata'

// Decorator factory with configuration options transient
export function Injectable() {
  return function (target: any) {
    Reflect.defineMetadata('injectable', true, target);
  };
}

// Decorator factory with configuration options 
export function Singleton<T extends { new (...args: any[]): {} }>(constructor: T) {
  let instance: T | null = null;

  // Return a new class that wraps the original
  return class extends constructor {
    constructor(...args: any[]) {
      // Return existing instance if available
      if (instance) {
        return instance;
      }
      super(...args);
      instance = this as any;
    }
  };
}



export class Container {
  
  protected dependencies : any[] = [];

  register(deps: any[]) {
    deps.map((target) => {
      const isInjectable = Reflect.getMetadata('injectable', target);
      if (!isInjectable) return;

      // get the typeof parameters of constructor
      const paramTypes = Reflect.getMetadata('design:paramtypes', target) || [];

      // resolve dependecies of current dependency
      const childrenDep = paramTypes.map((paramType: any) => {
        // recursively resolve all child dependencies:
        this.register([paramType]);

        if (!this.dependencies[paramType.name]) {
          this.dependencies[paramType.name] = new paramType();
          return this.dependencies[paramType.name];
        }
        return this.dependencies[paramType.name];
      });

      // resolve dependency by injection child classes that already resolved
      if (!this.dependencies[target.name]) {
        this.dependencies[target.name] = new target(...childrenDep);
      }
    });

    return this;
  }

  public get<T extends new (...args: any[]) => any>(
    serviceClass: T
  ): InstanceType<T> {
    return this.dependencies[serviceClass.name as any];
  }

  getInstanceOf<T extends new (...args: any[]) => any>(serviceClass: T){
    return this.get(serviceClass);
  }

  showDependencies()
  {
    console.log(this.dependencies);

  }
}