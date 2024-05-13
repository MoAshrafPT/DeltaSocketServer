function operationalTransform(delta, operations, clientVersion, serverVersion) {

    console.log("I am in operationalTransform", delta, clientVersion, serverVersion);
  
    let varIdx = 1;
    if (delta.ops[0] && !('retain' in delta.ops[0])) {
      delta.ops.unshift({ 'retain': 0 });
      console.log("unsaewaewadsshifting delta:", delta);
    }
    if (clientVersion >= serverVersion) {
      if (delta.ops[0] && delta.ops[0].retain == 0) {
        delta.ops = [delta.ops[1]];
      }
      console.log("I am returning delta", delta);
      return delta;
    }
    for (let i = clientVersion; i < serverVersion; i++) {
      if (operations[i].ops[0] && !('retain' in operations[i].ops[0])) {
        operations[i].ops.unshift({ 'retain': 0 });
      }
      console.log("I survived", i, "times");
      console.log(delta.ops, "delta.ops");
      console.log(operations[i], "operations[i]");
      if ('insert' in delta.ops[1]) {
        if ('insert' in operations[i].ops[1]) {
          if (delta.ops[0].retain >= operations[i].ops[0].retain) {
            console.log("I am insert insert", i);
            console.log(delta.ops[0].retain, "Retain1 in insert insert");
            console.log(operations[i].ops[1].insert.length, "Retain2 in insert insert");
            console.log(delta.ops[0].retain + operations[i].ops[1].insert.length, "Retain3 in insert insert");
            delta.ops[0].retain += operations[i].ops[1].insert.length-1;
            console.log(delta.ops[0].retain, "Retain4 in insert insert");
          }
        } else if ('delete' in operations[i].ops[1]) {
          if (delta.ops[0].retain >= operations[i].ops[0].retain) {
            delta.ops[0].retain -= operations[i].ops[1].delete;
            console.log("I am insert delete");
          }
        }
      } else if ('delete' in delta.ops[1]) {
        if ('insert' in operations[i].ops[1]) {
          if (delta.ops[0].retain >= operations[i].ops[0].retain) {
            delta.ops[0].retain += operations[i].ops[1].insert.length-1;
            console.log("I am delete insert");
          }
        } else if ('delete' in operations[i].ops[1]) {
          if (delta.ops[0].retain >= operations[i].ops[0].retain) {
            delta.ops[0].retain -= operations[i].ops[1].delete;
            console.log("I am delete delete");
          }
        }
      }
    }
    if (delta.ops[0] && delta.ops[0].retain == 0) {
      delta.ops = [delta.ops[1]];
    }
    console.log("I am returning delta", delta);
    return delta;
  }
 let deltaOps = [{ops: [ { insert: 'F' } ]},{ ops: [ { retain: 1 }, { insert: 'U' } ] },{ ops: [ { retain: 2 }, { insert: 'C' } ] }
 ,{ ops: [ { retain: 3 }, { insert: 'K' } ] }]