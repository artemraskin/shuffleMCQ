//used to clear parsedMCQ
let parsedMCQ_Header = '<table id="parsedMCQ">'+
      '<tr>'+
        '<th style="width:5ch">label</th>'+
        '<th>text</th>'+
        '<th style="width:4ch">key</th>'+
        '<th style="width:4ch">lock</th>'+
      '</tr>'+
    '</table>'




inputMCQ.onblur = parseMCQ;
inputAK.onblur = addAnswerKey;
testModeButton.onclick = toggleTestMode;
shuffleSectionsButton.onclick = shuffleSections;
shuffleQuestionsButton.onclick = shuffleQuestions;
shuffleAnswersButton.onclick = shuffleAnswers;


//PART 1: FUNCTIONS FOR PARSING THE MCQ INPUT


/*called by inputMCQ.onblur
  user enters multiple choice questions (MCQs) in the inputMCQ textarea.
  parseMCQ parses the user input and fills out the parsedMCQ table
*/
function parseMCQ (){


  parsedMCQ.outerHTML = parsedMCQ_Header;
  
  let userInput = inputMCQ.value;
  /*All sections have an empty line above and below them,
    so first and last sections should too.
    Third "\n" helps simplify the validate() function.
    TODO table doesn't actually create first and last row.
  */
  userInput = "\n"+userInput+"\n"+"\n"
  //replace various Unicode codes for new line with a regular new line
  userInput = userInput.replace(/[\u000a\u000b\u000c\u000d\u0085\u2028\u2029]/g, "\n");


  //split userInput by line
  let linesArray = userInput.split('\n');
  
  let previousRow;
  
  /*classify each line as section, question, answer, or emptyLine
    then pass it to createRow()
  */
  linesArray.forEach(function(line,index,array){
    let previousLine = array[index-1] || "";
    //firstWord can be A, B, C, D, E, 1/2/3-digit number, 'emptyLine', or 'other'
    let firstWord = parseFirstWord(line);
    let previousFirstWord = parseFirstWord(previousLine);
    let rowId = index+1; //first row is preset by parsedMCQ_Header. row.id used for debugging only
    let text = line;
    
    if (typeof(firstWord)=="number" && previousFirstWord=="emptyLine"){ //if line is a question:
        text = line.trim().split(' ').slice(1).join(' ');//remove question number
        previousRow = createRow("question", firstWord, text, rowId);
    } else if ((firstWord=="A" && typeof(previousFirstWord)=="number")||
               (firstWord=="B" && previousFirstWord=="A")||
               (firstWord=="C" && previousFirstWord=="B")||
               (firstWord=="D" && previousFirstWord=="C")||
               (firstWord=="E" && previousFirstWord=="D")) {//else if line is an answer:
      text = line.trim().split(' ').slice(1).join(' ');//remove answer letter label
      previousRow = createRow("answer", firstWord, text, rowId);
    } else if (firstWord=="emptyLine"){//else if line is empty:   
      if (previousFirstWord=="emptyLine"){
        //do nothing. Turn multiple empty lines into one empty row
      } else {
        previousRow = createRow("emptyLine", "", "", rowId);
      }
    } else {/*because the line is not a question, answer, or empty,
              it must be part a section header*/ 
      if (!previousRow || previousFirstWord=="emptyLine"){//if line is 1st line of a section:
         previousRow = createRow("section", "S", text, rowId);
      } else {/*because line is not the 1st line of a section,
                don't create a new row. instead, add to previous row.*/
        previousRow.children[1].children[0].innerHTML += "<br />" + line;
      }
    }
  })
  validateParsedMCQ();
}


/*Called by parseMCQ ()
  Parses one line from the inputMCQ textarea. Returns:
  'emptyLine' for empty lines,
  A, B, C, D or E for answer lines,
  [number] for question lines
*/
function parseFirstWord (line){
  
  //remove all invisible characters, so line that looks empty is actually empty
  let lineWithNoWhitespace = line.replace(/\s/g,"");
  if (lineWithNoWhitespace.length==0) return "emptyLine";
  /*TODO this enables questions&answers that start with a blank space,
    but their text then doesn't cut off the label properly
  */
  lineTrimmed = line.trim();
  let wordsArray = lineTrimmed.split(' ');
  let firstWord = wordsArray[0];
  
  //turn (10) and B. into 10 and B
  firstWord = firstWord.replace(/[\)\(\.]/g, "");
  
  /*if line starts with A,B,C,D,E, return answer letter
    (probably an answer line, but insertIntoTableByLine will double-check)
  */
  if (firstWord.length == 1 && firstWord.match(/[abcde]/i)){
    return firstWord.toUpperCase();
  /*if line starts with a 1-2-or-3-digit number, return question number
    (probably a question line, but InsertIntoTableByLine will double-check)
  */
  }else if (firstWord.length <= 3 && firstWord.match(/^[0-9]+$/g)){
    return +firstWord;
  }else{
    //Just in case. This return will not be used by another function.
    return "other";
  }
}


/*Called by parseMCQ ()
  convert line into a table row and append it to parsedMCQ table
*/
function createRow(class_Name, label, text, rowId){
  let row = document.createElement('tr');
  let labelTd = document.createElement('td');
  let textTd = document.createElement('td');
  //need div because can't style height of td
  let textDiv = document.createElement('div');
  let keyTd = document.createElement('td');
  let lockTd = document.createElement('td');
  
  row.className = class_Name;
  row.id = rowId;
  textDiv.className = "tableCellDiv";
  textDiv.textContent = text;
  textTd.append(textDiv);
  labelTd.textContent = label;
  if (class_Name == "answer"){
    keyTd.insertAdjacentHTML("afterbegin",'<input type="checkbox" name="key" value="correct"><br>') //TODO rename value
  }
  if (class_Name != "emptyLine"){
    lockTd.insertAdjacentHTML("afterbegin",'<input type="checkbox" name="lock" value="mustlock"><br>')
  }
  row.append(labelTd);
  row.append(textTd);
  row.append(keyTd);
  row.append(lockTd);
  
  parsedMCQ.append(row);
  return row;//used to remember previousRow in parseMCQ ()
}
    
/*Called by parseMCQ ()
  Checks if the parsedMCQ table follows expected MCQ pattern, such as:
   " S #ABCD #ABCD S #ABCDE #AB #ABC S #ABCD  "
  Highlights in red the lines that don't follow the pattern.
  Does not alter table content
*/
function validateParsedMCQ (){
  let rows = Array.from(parsedMCQ.children);
  rows.forEach (function(row,index,array){
    //skip table header
    if (index==0) return;
    /*first, last, and second-to-last rows are emptyLine
      because of the following code in parseMCQ():
      userInput = "\n"+userInput+"\n"+"\n"
    */
    if (index==1||index==rows.length-1||index==rows.length-2) return;
    
    let label = row.children[0].textContent;
    if (/\d{1,3}/.test(label)) {label="number"};//regex for 1/2/3-digit numbers
    
    let previousLabel = array[index-1].children[0].textContent;
    if (/\d{1,3}/.test(previousLabel)) {previousLabel="number"};
    
    let nextLabel = array[index+1].children[0].textContent;
    if (/\d{1,3}/.test(nextLabel)) {nextLabel="number"};
    
    let nextNextLabel = array[index+2].children[0].textContent;
    if (/\d{1,3}/.test(nextNextLabel)) {nextNextLabel="number"};
    
    // sections may only occur in the middle of a " S #" pattern
    if (label=="S" && (previousLabel!= "" || nextLabel!=""||nextNextLabel!="number")) {
      row.className = "error";
    }
    
    //emptyLines should not occur in the middle of a "#ABCD" pattern
    if (label=="" && (previousLabel=="A" || previousLabel=="number" || nextLabel==("A"||"B"||"C"||"D"||"E"))){
      row.className = "error";
    }
    
    //questions may only occur in the middle of a " #A" pattern
    if (label=="number" && (previousLabel!="" || nextLabel!="A")){
      row.className = "error";
    }
    
    //'A' answers may only occur in the middle of a "#AB" pattern
    if (label=="A" && (previousLabel!="number" || nextLabel!="B")){
      row.className = "error";
    }
    
    //'B' answers may only occur in the middle of "ABC" or "AB " patterns 
    if (label=="B" && (previousLabel != "A" || (nextLabel!="C" && nextLabel!=""))){
      row.className = "error";
    }
    
    //'C' answers may only occur in the middle of "BCD" or "BC " patterns
    if (label=="C" && (previousLabel != "B" || (nextLabel!="D" && nextLabel!=""))){
      row.className = "error";
    }
    
    //'D' answers may only occur in the middle of "CDE" or "CD " patterns
    if (label=="D" && (previousLabel != "C" || (nextLabel!="E" && nextLabel!=""))){
      row.className = "error";
    }
    
    //'E' answers may only occur in the middle of a "DE " pattern
    if (label=="E" && (previousLabel != "D" || nextLabel != "")){
      row.className = "error";
    }
  })
}






//PART 2: FUNCTIONS FOR SHUFFLING THE PARSED MCQ TABLE


/*called by shuffleSectionsButton.onclick
  shuffles sections in the parsedMCQ table
  keeps question order within each section intact
*/
function shuffleSections(){
  let sectionsByRow = splitParsedMCQIntoSections();
  
  /*Argument in shuffleArray() - locked sections stay in place when rest of sections are shuffled.
    Section indexes are not the same as row indexes - 1st section has index 0, 2nd section has index 1, etc.
  */
  let lockedIndexes = [];
  /*A section header is the first line of the section,
    i.e. the section not including its emptyLine(s), question(s), and answers.
  */
  let sectionHeaders = Array.from(parsedMCQ.getElementsByClassName("section"));
  sectionHeaders.forEach(function(header,index){
    //user locks a section by checking the lock-column checkbox next to its header
    if (header.children[3].firstElementChild.checked){
      lockedIndexes.push(index);
    }
  })
  
  shuffleArray(sectionsByRow, lockedIndexes);
  //sectionsByRow array has a depth of 1
  let rows = sectionsByRow.flat(1);
  
  //clear parsedMCQ table
  parsedMCQ.outerHTML = parsedMCQ_Header;
  
  rows.forEach(function(row){
    parsedMCQ.append(row);
    //TODO why doesn't table.append(row) work??
  })
  // question #s are out of order because sections were shuffled
  renumberQuestions();
  createOutputMCQ();
}


/*called by shuffleQuestionsButton.onclick
  shuffles questions in the parsedMCQ table within their respective sections
  keeps answer order within each question intact
*/
function shuffleQuestions(){


  let sectionsByQuestion = splitParsedMCQIntoSectionsIntoQuestions();


  sectionsByQuestion.forEach(function(section){
    /*Argument in shuffleArray() - locked questions stay in place when rest of questions are shuffled.
      Question indexes are not the same as row indexes - 1st question of each section has index 0.
      section[0] consists of section header and an empty row, so it should be auto-locked.
    */
    let lockedIndexes=[0];
    section.forEach(function(question,index){
      if (index==0) return;//skip section header
      //user locks a question by checking the lock-column checkbox next to it
      if (question[0].children[3].firstElementChild.checked){
        lockedIndexes.push(index);
      }
    })
    shuffleArray(section,lockedIndexes);
  })
  
  //sectionsByQuestion has a depth of 2  
  let rows = sectionsByQuestion.flat(2);
  
  //clear parsedMCQ table
  parsedMCQ.outerHTML = parsedMCQ_Header;
  
  rows.forEach(function(row){
    parsedMCQ.append(row);
  })
  //question #s are out of order because questions were shuffled
  renumberQuestions ();
  createOutputMCQ();
}


/*called by shuffleAnswersButton.onclick
  shuffles answer options in the parsedMCQ table within their respective questions
*/
function shuffleAnswers(table){
  //sectionsByQuestion has a depth of 2 
  let sectionsByQuestion = splitParsedMCQIntoSectionsIntoQuestions();
  
  /*tableByQuestion: [[sectionHeader],[question],[question],[sectionHeader],[question]...]
    each question: [row, row, row...]
  */
  let tableByQuestion =sectionsByQuestion.flat(1);
  
  //TODO make sure table always ends with emptyLine
  tableByQuestion.forEach(function(question){
    if (question[0].classList.contains("section")) return; //skip section headers
    /*Argument in shuffleArray() - locked answers stay in place when rest of answers are shuffled.
      Answer indexes are not the same as row indexes - 1st answer of each question has index 0.
      question[0] is the question itself, not one of the answers, so it should be auto-locked.
    */
    let lockedIndexes = [0];
    question.forEach(function(answer, index){
      //skip first row (question) and last row (emptyLine)
      if (index==0 || index==question.length-1) return;
      //user locks an answer by checking the lock-column checkbox next to it
      if (answer.children[3].firstElementChild.checked){
      lockedIndexes.push(index);
      }
    })
    lockedIndexes.push(question.length-1);
    shuffleArray(question,lockedIndexes);  
  })
  
  let rows = tableByQuestion.flat(1);
  
  //clear parsedMCQ table
  parsedMCQ.outerHTML = parsedMCQ_Header;
  
  rows.forEach(function(row){
    parsedMCQ.append(row);
  })
  //answer letter labels are out of order because answers were shuffled
  reletterAnswers();
  createOutputMCQ();
}


/*called by shuffleSections(), shuffleQuestions(),shuffleAnswers()
  array will be shuffled in place
  lockedIndexes are indexes or array elements that should not be shuffled
  lockedIndexes must be in ascending order
*/
function shuffleArray(array, lockedIndexes) {
  let unlockedElements = array; //elements in the passed array that should be shuffled
  let lockedElements = []; //elements in the passed array that should not be shuffled
  
  //add locked elements to the lockedElements array
  lockedIndexes.forEach(function(item){
    lockedElements.push(array[item]);
  })


  //TODO splice returns deleted items, use that to rewrite this code
  /*remove locked elements from the unlockedElements array
    loop from end to start. if loop from start to end, indexes will shift when element is deleted
  */
  for (let i = lockedIndexes.length-1; i>=0; i--){
    let lockedIndex = lockedIndexes[i];
    unlockedElements.splice(lockedIndex,1);
  }
  
  //shuffle unlockedElements
  for (let i = unlockedElements.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unlockedElements[i], unlockedElements[j]] = [unlockedElements[j], unlockedElements[i]];
  }
  
  //return locked elements back into their original array indexes
  lockedIndexes.forEach(function(item, index){
    unlockedElements.splice(item,0,lockedElements[index]);
  })
  
  array=unlockedElements;
}


/*called by shuffleSections, splitParsedMCQIntoSectionsIntoQuestions()
  converts the parsedMCQ table into a nested array with the following structure:
    parsedMCQ: [[section],[section],[section]...]
    each section: [row,row,row,row...]
*/
function splitParsedMCQIntoSections(){
  //TODO why doesn't Array.from(table.children) work??
  let rows = Array.from(parsedMCQ.children);
  let sectionsByRow = [];
  
  rows.forEach(function(row,index){
    if (index==0) return;//skip table header. TODO redo this if add emptyLine at top of parsedMCQ
    if (row.classList.contains("section")){//if row is section header, create new section array
      let section = [];
      section.push(row);
      sectionsByRow.push(section);
    }else{//if row is a question/answer/emptyLine, add it to the current section array
      let currentSectionIndex = sectionsByRow.length-1;
      sectionsByRow[currentSectionIndex].push(row);
    }
  })
  return sectionsByRow;
}


/*called by splitParsedMCQIntoSectionsIntoQuestions()
  converts a flat array of a section with the following structure:
    section: [row,row,row,row...]
  into a nested array with the following structure:
    section: [[header],[question],[question]...]
    each question: [row,row,row,row...]
*/
function splitIntoQuestions(section){


  let questions = [];
  
  //sectionHeader array is the section header row and the subsequent empty row
  let sectionHeader=[section[0],section[1]];
  questions.push(sectionHeader);
  
  section.forEach(function(row, index){
    if (index==0 || index==1) return;//skip sectionHeader
    if (row.classList.contains("question")){//if row is a question, create new question array
      let question = [];
      question.push(row);
      questions.push(question);
    }else{//if row is an answer/emptyLine, add it to the current question array
      let currentQuestionIndex = questions.length-1;
      questions[currentQuestionIndex].push(row);
    }
  })
  return questions;
}


/*called by shuffleQuestions(), shuffleAnswers()
  converts the parsedMCQ table into a nested array with the following structure:
    parsedMCQ: [[section],[section],[section]...]
    each section: [[header],[question],[question]...]
    each question: [row,row,row,row...]
*/
function splitParsedMCQIntoSectionsIntoQuestions(){
  let sectionsByRow = splitParsedMCQIntoSections();
  let sectionsByQuestion = [];
  
  sectionsByRow.forEach(function(section){
    sectionsByQuestion.push(splitIntoQuestions(section));  
  })
  return sectionsByQuestion;
}


/*called by shuffleSections(), shuffleQuestions()
  overwrites questions #s in the label column with 1,2,3...n
*/
function renumberQuestions (){
  let questionRows = Array.from(parsedMCQ.getElementsByClassName("question"));
  questionRows.forEach(function(item,index){
    item.children[0].textContent = index+1;
  })
}


/*called by shuffleAnswers()
  overwrites letter label for first answer under each question with 'A',
  second letter label under each question with 'B' etc.
*/
function reletterAnswers(){
  let questionRows = parsedMCQ.getElementsByClassName("question");
  let letters = ["A", "B", "C", "D", "E"];
  
  for (let row of questionRows){
    
    let letterIndex = 0;
    
    function reletterAnswer(row, letterIndex){
      let nextRow = row.nextElementSibling;
      if (nextRow.classList.contains("answer")&&letterIndex<=4){
        //letters[0] is 'A', letters[1] is 'B' etc
        row.nextElementSibling.children[0].textContent = letters[letterIndex];
        letterIndex++;
        reletterAnswer(nextRow, letterIndex)
      }
    }
    reletterAnswer(row, letterIndex);
  }
}


/*called by shuffleSections(), shuffleQuestions(), shuffleAnswers()
  converts parsedMCQ table into outputMCQ text by row
  creates answer key based on checked key-column checkboxes
*/
function createOutputMCQ(){
  outputMCQ.innerHTML="";//clear outputMCQ
  let rows = Array.from(parsedMCQ.children);
  let answerKey = "<br>Answer Key";
  
  rows.forEach(function(item, index){
    if (index==0) return;//skip table header
    let text;//parsedMCQ row converts into this outputMCQ text
    
    if (item.classList.contains("section")){
      text = item.children[1].textContent;
    }
    
    if (item.classList.contains("emptyLine")){
      text = "";
    }
    
    if (item.classList.contains("question")){
      text = item.children[0].textContent+". "+item.children[1].textContent;
      //count how many answer options this question has
      let answers = [];
      let i=1;
      while (rows[index+i].classList.contains("answer")){
        answers.push(rows[index+i]);
        i++;
        if (i>5) break;
      }
      let correctAnswers="";
      /*for each answer option with a checked key-column checkbox, add its letter label to correctAnswers
        this allows for multiple correct answers per question
      */
      answers.forEach(function(item){
        if (item.children[2].firstElementChild.checked){
          correctAnswers += item.children[0].textContent;
        }
      })
      //add correctAnswers for this question to answerKey
      answerKey += "<br>"+item.children[0].textContent+". "+correctAnswers;
    }
    
    if (item.classList.contains("answer")){
      text = item.children[0].textContent+". "+item.children[1].textContent;
    }
    
    let html = "<br>"+text;
    outputMCQ.insertAdjacentHTML("beforeend", html)
  })
  outputMCQ.insertAdjacentHTML("beforeend", answerKey)
}


//PART 3: ANSWER KEY FUNCTIONS


/*called by inputAK.onblur
  parses inputAK textarea for user-input answer key
  checks key-column checkboxes in the parsedMCQ table next to correct answers based on answer key
  creates parsedAK table based on answer key, one row per question
  validates answer key and highlights rows in parsedAK table if they have an error
*/
function addAnswerKey (){
  let userInput = inputAK.value.toUpperCase();//so that, for example, 'b' and 'B' answers are treated the same
  //array of rawKeys. each rawKey is a string of one number followed by some non-numbers that hopefully include A/B/C/D/E
  let rawKeys = splitByNumber(userInput);
  let rowsMCQ = Array.from(parsedMCQ.children);
  let answers = parsedMCQ.getElementsByClassName("answer");
  let parsedAK_Header = '<table id="parsedAK">'+
  ' <tr>'+
  '   <th style="width:4ch">Q</th>'+
  '   <th style="width:4ch">A</th>'+
  ' </tr>'+
  '</table>'
  
  //reset all key-column checkboxes to not checked
  for (answer of answers){
    answer.children[2].firstElementChild.checked = false;  
  }
  //reset the parsedAK table
  parsedAK.outerHTML = parsedAK_Header;
  
  //nested forEach loops: go through each rawKey and compare it to each parsedMCQ row
  rawKeys.forEach(function(rawKey){
    
    let number = rawKey.match(/\d+/);//regex for 1-or-more-digit number
    let rowAK = document.createElement('tr');
    let QTdAK = document.createElement('td');//Td for Question # in parsedAK
    let ATdAK = document.createElement('td');//Td for correct Answer letter(s) in parsedAK
    
    QTdAK.textContent = number;


    let correctAnswerIndexes = [];//used later for rowsMCQ[index+correctAnswerIndex]
    
    if (rawKey.includes("A")){
      correctAnswerIndexes.push(1);
      ATdAK.textContent+="A";
    }
    if (rawKey.includes("B")){
      correctAnswerIndexes.push(2);
      ATdAK.textContent+="B";
    }
    if (rawKey.includes("C")){
      correctAnswerIndexes.push(3);
      ATdAK.textContent+="C";
    }
    if (rawKey.includes("D")){
      correctAnswerIndexes.push(4);
      ATdAK.textContent+="D";
    }
    if (rawKey.includes("E")){
      correctAnswerIndexes.push(5);
      ATdAK.textContent+="E";
    }
    
    rowAK.append(QTdAK);
    rowAK.append(ATdAK);
    parsedAK.append(rowAK);
    
    let matchCount = 0;//number of times question number from answer key is found in parsedMCQ question numbers
    if (correctAnswerIndexes.length>0){
      rowsMCQ.forEach(function(rowMCQ, index){
        if (!rowMCQ.classList.contains("question")) return;
        //for each MCQ row that has a question, check if it matches the number in the current rawKey
        if (rowMCQ.children[0].textContent == number){
          matchCount++;
          correctAnswerIndexes.forEach(function(correctAnswerIndex){
            /*in parsedMCQ table, A is (question-row index)+1, B is (question-row index)+2 etc
              correctAnswerIndexes array sets A to 1, B to 2 etc
              so index+correctAnswerIndex is the parsedMCQ-index of the correct answer
            */
            if (rowsMCQ[index+correctAnswerIndex].classList.contains("answer")){
              rowsMCQ[index+correctAnswerIndex].children[2].firstElementChild.checked = true;
            }else{//error type 1: answer letter not found in question (e.g. 'D' can't be an answer to true/false question)
              rowAK.className = "error";  
            }
          })
        }
      })
    }else{//error type 2: user forgot to include answer letter
      rowAK.className = "error";
    }
    if (matchCount!=1) {//error type 3: question number from answer key not found in parsedMCQ or found more than once
      rowAK.className = "error";
    }
  })
}


/*called by addAnswerKey();
  separates string into an array of sub-strings,
  where each sub-string starts with a 1-or-more-digit number
*/
function splitByNumber(str){
  let rawKeys = [];
  function createRawKeys(str){
    if (str=="") return;
    let rawKey = str.match(/\d+\D+/).toString();//regex for 1-or-more digits followed by 1-or-more non-digits
    let rawKeyIndex = str.match(/\d+\D+/).index;//position of where rawKey begins in str
    let remainder = str.slice(rawKeyIndex+rawKey.length,str.length);//sub-string after end of rawKey
    rawKeys.push(rawKey);
    createRawKeys (remainder)
  }
  createRawKeys(str);
  return rawKeys;
}
    
    
//PART 4: TEST MODE


function toggleTestMode(){
  
  console.log(testModeButton.value)
  let testMCQ = "Delete this sample input and enter your MC questions here.\n"+
  "    The questions in this first section refer to Star Wars.\n"+
  "    \n"+
  "1. Darth Vader would enjoy a long walk on the beach \n"+
  "     a) true\n     "+
  " B. false\n"+
  "    \n"+
  "3) Select all characters who were secretly Sith Lords.  \n"+
  "    (A Chancellor Palpatine\n"+
  "      b.    Mace Windu\n"+
  ".C. Chancellor Valorum\n"+
  "d. Jar Jar Binks\n"+
  "\n"+
  "The questions in Section 3 refer to the Simpsons.\n"+
  "\n"+
  "   5 Who shot Mr. Burns?\n"+
  "    a. Lisa\n"+
  "b Marge\n"+
  "c. Bart\n"+
  "D Homer\n"+
  "(E.) Maggie\n"+
  "        \n"+
  "(6) Which of the following characters is left-handed?\n"+
  "    a Seymour Skinner\n"+
  " B Ned Flanders\n"+
  " c) Moe Szyslak\n"+
  "D all of the above\n"
  
  let testAK = "1 bd5 e\n"+
  "   3. a,,d \n"+
  "22 is fa\n"+
  "6====    \n"
  
  //testModeButton.value == "" on the very first click after page is refreshed
  if (testModeButton.value =="Enter<br>Test Mode"||testModeButton.value ==""){
    inputMCQ.value = testMCQ;
    inputAK.value = testAK;
    testModeButton.value ="Exit<br>Test Mode";//TODO runs in JS but doesn't affect HTML
  }else{
    inputMCQ.value = "";
    inputAK.value = "";
    testModeButton.value ="Enter<br>Test Mode";
  }
}