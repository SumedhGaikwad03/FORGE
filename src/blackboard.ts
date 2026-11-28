// this is the black borad file that we need to make the mutiple orchration possible 

export interface BlackboardFinding {
  task : string ;
  result  : string ;
  timestamp : number ;
}

export class Blackboard{

  // we have to maintain the chronological log of the findings 
  private findings : BlackboardFinding[] = []; 

  // this is an function to record a completed task 
  addFinding(task : string , result : string) : void {
    this.findings.push({
      task ,
      result : result.trim(),
      timestamp: Date.now(),
    });
  }

  // this is now a function to get all the findings
  // here we instead return a shallow copy for the same 
  getAllFindings(): BlackboardFinding[] {
    return [...this.findings];
  }

  // now this function below in the findings creates a snapshot of
  // the findings and then injects them into the sub agents to work upon 
  getSnapshot() : string {
    if(this.findings.length === 0){
      return "No shared findings on the blackBoard Yet ";
    }
 
    // the entire array is transformed into formatted sibling discovery blocks here 
    return this.findings.map((f,i)=> `[Discovered by Sibling Agent ${i+1} | task : "${f.task}"]: \n${f.result}`
    ).join("\n\n");
  }

  // this function is used to clear the black board memory 
  clear():void {
    this.findings = [];
  }
}
