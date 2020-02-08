// USAGE:
// node test.js -r README.md  (Checks whole file)
// node test.js -r README.md -d temp.md  (Checks just the diff)

const fs = require('fs');
//let colors = require('colors/safe');
const chalk = require('chalk');
let licenses = new Set();
let pr = false;
let readme;
let diff;

//Parse the command options and set the pr var
function parseArgs(args) {
  if ( args.indexOf('-r', 2) > 0 ) {
    readme = fs.readFileSync(args[args.indexOf('-r', 2)+1], 'utf8')
  }
  if (args.indexOf('-d', 2) > 0) {
    pr = true;
    diff = fs.readFileSync(args[args.indexOf('-d', 2)+1], 'utf8');
  }
  if ( pr === true) {
    console.log(chalk.blue(`Running on PR. README.md: ${args[args.indexOf('-r', 2)+1]} diff: ${args[args.indexOf('-d', 2)+1]}`))
  }
}

// Function to find lines with entries
function entryFilter(md) { 
  const linepatt = /^\s{0,2}-\s\[.*`/;
  return linepatt.test(md);
}

// Function to find lines with licenses
function licenseFilter(md) {
  const linepatt = /^- `.*` - .*/;
  return linepatt.test(md)
}

// Function to split lines into array
function split(text) { 
  return text.split(/\r?\n/);
}

// All entries should match this pattern.  If matches pattern returns true.
function findPattern(text) { 
  const patt = /^\s{0,2}-\s\[.*?\]\(.*?\) (`⚠` )?- .{0,249}?\.( \(\[(Demo|Source Code|Clients)\]\([^)]*\)(, \[(Source Code|Clients)\]\([^)]*\))?(, \[(Source Code|Clients)\]\([^)]*\))*\))? \`.*?\` \`.*?\`$/;
  if (patt.test(text) === true) {
    return true;
  } 
  return false;
}

// Parses SPDX identifiers from list of licenses
function parseLicense(md) {
  const patt = /^- `(.*)` - .*/
  return patt.exec(md)[1]
}

//Tests '- [Name](http://homepage/)'
function testMainLink(text) { 
  let testA = /(^ {0,2}- \[.*?\]\(.*\))(?=.?-? ?\w)/;
  const testA1 = /(- \[.*?\]?\(?.*?\)?)( .*$)/;
    if (testA.test(text) === false) {
    let a1 = testA1.exec(text)[2];
    return chalk.red.underline(text.replace(a1, ''))
  }
  return chalk.green(testA.exec(text)[1])
}

//Tests  '`⚠` - Short description, less than 250 characters.'
function testDescription(text) { 
  const testB = /( - .*\. )(?:(\(?\[?|\`))/;
  const testA1 = /(- \[.*?\]?\(?.*?\)?)( .*$)/;
  const testB2 = /((\(\[|\`).*$)/;
  if (testB.test(text) === false) {
    let b1 = testA1.exec(text)[1];
    let b2 = testB2.exec(text)[1];
    return chalk.red.underline(text.replace(b1, '').replace(b2, ''))
  } 
  return chalk.green(testB.exec(text)[1])
}

//If present, tests '([Demo](http://url.to/demo), [Source Code](http://url.of/source/code), [Clients](https://url.to/list/of/related/clients-or-apps))'
function testSrcDemCli(text) { 
  let testC = text.search(/\(\[|\)\,|\)\)/);
  let testD = /(?<=\w. )(\(\[(Demo|Source Code|Clients)\]\([^)]*\)(, \[(Source Code|Clients)\]\([^)]*\))?(, \[(Source Code|Clients)\]\([^)]*\))*\))(?= \`?)/;
  const testD1 = /(^.*\.)(?= )/;
  const testD2 = /(\`.*\` \`.*\`$)/;
  if ((testC > -1) && (testD.test(text) === false)) {
    let d1 = testD1.exec(text)[1];
    let d2 = testD2.exec(text)[1];
    return chalk.red.underline(text.replace(d1+' ', '').replace(d2, ''))
} else if (testC > -1) {
  return chalk.green(testD.exec(text)[1])
}
return ""
}

// Tests '`License` `Language`'
function testLangLic(text) { 
  const testD2 = /(\`.*\` \`.*\`$)/;
  let testE = testD2.test(text);
  const testE1 = /(^[^`]*)/;
  if (testE === false) {
    let e1 = testE1.exec(text)[1];
    return chalk.red.underline(text.replace(e1, ''))
  }
  return chalk.green(testD2.exec(text)[1])
}

//Runs all the syntax tests...
function findError(text) {
  let res
  res = testMainLink(text)
  res += testDescription(text)
  res += testSrcDemCli(text)
  res += testLangLic(text)
  return res + `\n`
}
//Check if license is in the list of licenses.
function testLicense(md) {
  const regex = /.*\`(.*)\` \`.*\`$/;
  return licenses.has(regex.exec(md)[1])
}

//Parses name from entry
function parseName(md) {
  const regex = /^\W*(.*?)\W/
  return regex.exec(md)[1]
}

function entryErrorCheck() {
  const lines = split(readme); // Inserts each line into the entries array
  let totalFail = 0;
  let totalPass = 0;
  let total = 0;
  let failed = [];
  let entries = [];
  let diffEntries = [];

  if (lines[0] === "") {
    console.log(chalk.red("0 Entries Found"))
    process.exit(0)
  }
  for (let i = 0; i < lines.length; i ++) { // Loop through array of lines
    if (entryFilter(lines[i]) === true) { // filter out lines that don't start with * [)
      e = {};
      e.raw = lines[i];
      e.line = i
      entries.push(e);
    } else if (licenseFilter(lines[i]) === true) {
      licenses.add(parseLicense(lines[i]))
    }
  }

  if (pr === true) {
    console.log(chalk.cyan("Only testing the diff from the PR."))
    const diffLines = split(diff); // Inserts each line of diff into an array
    for (let l of diffLines) {
      if (entryFilter(l) === true) { // filter out lines that don't start with * [)
      e = {};
      e.raw = l;
      diffEntries.push(e);
      } else if (licenseFilter(l) === true) {
        licenses.add(parseLicense(l))
      }
    }
    total = diffEntries.length
    for (let e of diffEntries) {
      e.pass = true
      e.name = parseName(e.raw)
      if (!findPattern(e.raw)) {
        e.highlight = findError(e.raw);
        e.pass = false;
        console.log(`${e.highlight}`)
      }
      e.licenseTest = testLicense(e.raw);
      if (e.licenseTest === false) {
        e.pass = false;
        console.log(chalk.yellow(`${e.name}'s license is not on License list.`))
      }
      if (e.pass) {
        totalPass++
      } else {
        totalFail++
      }
   }
  } else {
    console.log(chalk.cyan("Testing entire README.md"))
    total = entries.length
    for (let e of entries) {
      e.pass = true
      e.name = parseName(e.raw)
      if (!findPattern(e.raw)) {
        e.highlight = findError(e.raw);
        e.pass = false;
        console.log(`${chalk.yellow(e.line)} ${e.highlight}`)
      }
      e.licenseTest = testLicense(e.raw);
      if (e.licenseTest === false) {
        e.pass = false;
        console.log(chalk.yellow(`${e.line} ${e.name}'s license is not on License list.`))
      }
      if (e.pass) {
        totalPass++
      } else {
        totalFail++
      }
   }
  }


  if (totalFail > 0) {
    console.log(chalk.blue(`\n-----------------------------\n`))
    console.log(chalk.green("The portion of the entry with an error ") + chalk.underline.red("will be underlined and RED") + `\n`)
    console.log(chalk.blue(`\n-----------------------------\n`))
    console.log(chalk.red(`${totalFail} Failed, `) + chalk.green(`${totalPass} Passed, `) + chalk.blue(`of ${total}`))
    console.log(chalk.blue(`\n-----------------------------\n`))
    process.exit(1);
  } else {
    console.log(chalk.blue(`\n-----------------------------\n`))
    console.log(chalk.green(`${totalPass} Passed of ${total}`))
    console.log(chalk.blue(`\n-----------------------------\n`))
    process.exit(0)
  }

  
}

parseArgs(process.argv)
entryErrorCheck();
