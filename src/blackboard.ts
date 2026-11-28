// this is the black borad file that we need to make the mutiple orchration possible 

//import { timeRangeToJSON } from "@openrouter/sdk/models/operations";

export interface BlackboardFinding {

  task : string ;
   
  result  : string ;

  timestamp : number ;

}

export class Blackboard{

  // we need a key value stored for the process of structured facts 

  private memory = new Map<string , any>(); 

  // we also have to maintain the cronological log of the findings 

  private findings : BlackboardFinding[] = []; 

  // this is the mechasima to store the key value pairs in the system 

  set(key : string , value : any ) : void {

    this.memory.set(key,value);
  }

  // this snipped is used to check if the key exists 
  has(key: string) : boolean {

    return this.memory.has(key);
  }

  // this is used to retreive an fact from the memory 
  get<T = any>(key : string) : T | undefined {
  return this.memory.get(key);
  } 


  // this is an function to recoed an completed task 

  addFinding(task : string , result : string) : void {

    this.findings.push({
      task ,
      result : result.trim(),
      timestamp: Date.now(),

    });
  }

  // this is now a function to get all the finding 
// here we insted return an shllow copy for the same 
  getAllFindings(): BlackboardFinding[] {

    return [...this.findings];
  }

  // now this function below in the findings creates an snapshot of
  // the findings and then injects them into the sub agents to work upon 

  getSnapshot() : string {

    if(this.findings.length===0){

      return "No shared findings on the blackBoard Yet "
    }
 
    // the entire array is transformed into a single multi line array here 
    return this.findings.map((f,i)=> `[Discovered by Sibling Agent ${i+1} | task : "${f.task}"]): \n${f.result}`
  ).join("\n\n");

  }


  // this function is used to clear the black board memory 
  clear():void {

    this.memory.clear();
    this.findings= [];
  }
}