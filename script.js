'use strict';

//used to clear parsed_mcq
let parsedMcqHeader = '<table id="parsed_mcq" style="display:table">'+
                            '<tr id="0">'+
                                '<th style="width:5ch">label</th>'+
                                '<th>text</th>'+
                                '<th style="width:4ch">key</th>'+
                                '<th style="width:4ch">lock</th>'+
                            '</tr>'+
                        '</table>'

let before_question_number = document.getElementsByName('before_question_number')[0];
let after_question_number = document.getElementsByName('after_question_number')[0];
let before_answer_letter = document.getElementsByName('before_answer_letter')[0];
let after_answer_letter = document.getElementsByName('after_answer_letter')[0];


detectIE();

//PART 1: FUNCTIONS FOR PARSING THE MCQ INPUT

let rowId = 0; //used for debugging only
let previousRow; //not counting empty lines

//User enters MCQs in input_mcq textarea. Parses user input and build parsed_mcq table.
function parseMCQ ()
{
    //reset
    parsed_mcq.outerHTML = parsedMcqHeader;
    previousRow = undefined;
    rowId = 0;

    const userInput = input_mcq.value.trim().replace(/[\u000a\u000b\u000c\u000d\u0085\u2028\u2029]/g, "\n"); //replace various Unicode codes for new line with a regular new line

    const blocks = userInput.split(/\n\s*\n/); //split by empty line
    blocks.forEach(parseBlock);

    validateParsedMCQ();
    createOutput();
    go_to_step_2_button.style.display = 'block';
    user_guide.style.display = 'none';
}

function parseBlock(block, index)
{
    if (isNum(getLabel(block))) //question block
    {
        if (index==0) //second row must be a section header, otherwise splitParsedMCQIntoSections() breaks
        {
            previousRow = createRow('S', '');
            createRow('', '');
        }

        parseQuestionBlock(block);
        createRow('', '');
    }
    else //section header block
    {
        if (index>0 && previousRow.className == 'section') //merge consecutive section header blocks into one section header
        {
            previousRow.children[1].children[0].innerHTML += "<br><br>" + block;
        }
        else
        {
            previousRow = createRow('S', block);
            createRow('', '');
        }
    }
}

function getLabel (text)
{
    const label = splitOffLabel(text).replace(/[\)\(\.]/g, ''); //turn (10) and B. into 10 and B
    if (isNum(label)) return +label; //if text starts with a 1-2-or-3-digit number, return question number
    if (isABCDE(label)) return label.toUpperCase(); //if text starts with A/B/C/D/E, return answer letter
    return false;
}

//split question block into question and answers, pass to createRow()
function parseQuestionBlock(block)
{
    const questionAndAnswers = block.trim().split(/\n(?=[\s\)\(\.]*[abcde][\s\)\(\.]*\s)/i); //split by newline followed by answer label

    questionAndAnswers.forEach(function(q_or_a){        
        previousRow = createRow
        (
            getLabel(q_or_a),
            splitOffLabel(q_or_a, true) //remove label
        )
    })
}

function splitOffLabel (text, returnRemainder=false)
{
    const [label, remainder] = text.trim().split(/\s(.+)/s);
    if (returnRemainder) return remainder;
    return label;
}

//convert to table row, append to parsed_mcq table
function createRow(label, text)
{
    const row = document.createElement('tr');
    const labelTd = document.createElement('td');
    const textTd = document.createElement('td');
    const textDiv = document.createElement('div'); //need div because can't style height of td
    const keyTd = document.createElement('td');
    const lockTd = document.createElement('td');

    if (label==='S') row.className = 'section';
    if (label==='') row.className = 'emptyLine';
    if (isNum(label)) row.className = 'question';
    if (isABCDE(label)) row.className = 'answer';

    rowId++;
    row.id = rowId;
    textDiv.className = 'tableCellDiv';
    textDiv.innerHTML = text.replace(/\n/g, "<br>");
    textTd.append(textDiv);
    labelTd.textContent = label;

    if (row.className == 'answer')
    {
        keyTd.insertAdjacentHTML("afterbegin",'<input type="checkbox" onclick=createOutput() name="key'+rowId+'"><br>');
    }

    if (row.className != 'emptyLine')
    {
        lockTd.insertAdjacentHTML("afterbegin",'<input type="checkbox" name="lock'+rowId+'"><br>');
    }

    row.append(labelTd);
    row.append(textTd);
    row.append(keyTd);
    row.append(lockTd);

    parsed_mcq.append(row);

    return row;
}

// check if the parsed_mcq table follows expected pattern, such as ' S #ABCD #ABCD S #ABCDE #AB #ABC S #ABCD  '
function validateParsedMCQ ()
{
    let rows = Array.from(parsed_mcq.children);

    rows.forEach (function(row, index, array){
        if (index == 0) return; //skip table header
        if (index == rows.length-1) return; //skip last row, which is empty

        const label = row.children[0].textContent;

        const previousLabel = (index > 1)
            ? array[index-1].children[0].textContent
            : ''; //table header has no label

        const nextLabel = array[index+1].children[0].textContent;

        const nextNextLabel = (index < rows.length - 2)
            ? array[index + 2].children[0].textContent
            : ''; //2nd-to-last row has no next-next row

        if (label=='S') //sections may only occur in the middle of a ' S #' pattern
        {
            if (previousLabel!=='' || nextLabel!=='' || !isNum(nextNextLabel)) row.className='error';
        }
        
        if (label=='') //emptyLines should not occur in the middle of a '#ABCD' pattern
        {
            if (previousLabel=='A' || isNum(previousLabel) ||  isABCDE(nextLabel)) row.className='error';
        }
        
        if (isNum(label)) //questions may only occur in the middle of a ' #A' pattern
        {
            if (previousLabel!=='' || nextLabel!='A') row.className='error';
        }

        if (label=='A') //'A' answers may only occur in the middle of a '#AB' pattern
        {
            if (!isNum(previousLabel) || nextLabel!='B') row.className='error';
        }

        if (label=='B') //'B' answers may only occur in the middle of 'ABC' or 'AB ' patterns 
        {
            if (previousLabel!='A' || (nextLabel!='C' && nextLabel!=='')) row.className='error';
        }

        if (label=='C') //'C' answers may only occur in the middle of 'BCD' or 'BC ' patterns
        {
            if (previousLabel!='B' || (nextLabel!='D' && nextLabel!=='')) row.className='error';
        }

        if (label=='D') //'D' answers may only occur in the middle of 'CDE' or 'CD ' patterns
        {
            if (previousLabel!='C' || (nextLabel!='E' && nextLabel!=='')) row.className='error';
        }

        if (label=='E') //'E' answers may only occur in the middle of a 'DE ' pattern
        {
            if (previousLabel!='D' || nextLabel!='') row.className='error';
        }
    })
}

function isNum (label)
{
    if (/^\d{1,3}$/.test(label)) return true;
    return false;
}

function isABCDE (label)
{
    if (/^[abcde]$/i.test(label)) return true;
    return false;
}

//PART 2: FUNCTIONS FOR SHUFFLING THE PARSED MCQ TABLE

//shuffle sections in the parsed_mcq table, keep question order within each section intact
function shuffleSections()
{
    let sectionsByRow = splitParsedMCQIntoSections();

    /*lockedIndexes will be an argument in shuffleArray() - locked sections stay in place when rest of sections are shuffled.
    Section indexes are not the same as row indexes - 1st section has index 0, 2nd section has index 1, etc.
    */
    let lockedIndexes = [];
    /*A section header is the first row of the section,
    i.e. the section not including its emptyLine(s), question(s), and answers.
    */
    let sectionHeaders = Array.from(parsed_mcq.getElementsByClassName('section'));
    sectionHeaders.forEach(function(header,index){
        if (header.children[3].firstElementChild.checked) //user locks a section by checking the lock-column checkbox next to its header
        {
            lockedIndexes.push(index);
        }
    })

    shuffleArray(sectionsByRow, lockedIndexes);
    
    let rows = sectionsByRow.flat(1); //sectionsByRow array has a depth of 1

    parsed_mcq.outerHTML = parsedMcqHeader; //clear parsed_mcq table

    rows.forEach(function(row){
        parsed_mcq.append(row);
    })

    // question #s are out of order because sections were shuffled
    renumberQuestions();
    createOutput();
}

//shuffle questions in the parsed_mcq table within their respective sections, keep answer order within each question intact
function shuffleQuestions()
{
    let sectionsByQuestion = splitParsedMCQIntoSectionsIntoQuestions();

    sectionsByQuestion.forEach(function(section){
        /*lockedIndexes will be an argument in shuffleArray() - locked questions stay in place when rest of questions are shuffled.
        Question indexes are not the same as row indexes - 1st question of each section has index 0.
        section[0] consists of section header and an empty row, so it should be auto-locked.
        */
        let lockedIndexes=[0];
        section.forEach(function(question,index){
            if (index==0) return; //skip section header
            if (question[0].children[3].firstElementChild.checked) //user locks a question by checking the lock-column checkbox next to it
            {
                lockedIndexes.push(index);
            }
        })
        shuffleArray(section,lockedIndexes);
    })

    let rows = sectionsByQuestion.flat(2); //sectionsByQuestion has a depth of 2

    parsed_mcq.outerHTML = parsedMcqHeader; //clear parsed_mcq table

    rows.forEach(function(row){
        parsed_mcq.append(row);
    })
    
    renumberQuestions(); //question #s are out of order because questions were shuffled
    createOutput();
}

//shuffle answer options in the parsed_mcq table within their respective questions
function shuffleAnswers(table){
    //sectionsByQuestion has a depth of 2 
    let sectionsByQuestion = splitParsedMCQIntoSectionsIntoQuestions();
    /*tableByQuestion: [[sectionHeader],[question],[question],[sectionHeader],[question]...]
    each question: [row, row, row...]
    */
    let tableByQuestion =sectionsByQuestion.flat(1);

    tableByQuestion.forEach(function(question){
        if (question[0].classList.contains("section")) return; //skip section headers
        /*lockedIndexes will be an argument in shuffleArray() - locked answers stay in place when rest of answers are shuffled.
        Answer indexes are not the same as row indexes - 1st answer of each question has index 0.
        question[0] is the question itself, not one of the answers, so it should be auto-locked.
        */
        let lockedIndexes = [0];
        question.forEach(function(answer, index)
        {
            if (index==0 || index==question.length-1) return; //skip first row (question) and last row (emptyLine)
            if (answer.children[3].firstElementChild.checked) //user locks an answer by checking the lock-column checkbox next to it
            {
                lockedIndexes.push(index);
            }
        })
        lockedIndexes.push(question.length-1);
        shuffleArray(question,lockedIndexes);  
    })

    let rows = tableByQuestion.flat(1);

    parsed_mcq.outerHTML = parsedMcqHeader; //clear parsed_mcq table

    rows.forEach(function(row){
        parsed_mcq.append(row);
    })
    reletterAnswers(); //answer letter labels are out of order because answers were shuffled
    createOutput();
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
    for (let i = lockedIndexes.length-1; i>=0; i--)
    {
        let lockedIndex = lockedIndexes[i];
        unlockedElements.splice(lockedIndex,1);
    }

    //shuffle unlockedElements
    for (let i = unlockedElements.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1));
        [unlockedElements[i], unlockedElements[j]] = [unlockedElements[j], unlockedElements[i]];
    }

    //return locked elements back into their original array indexes
    lockedIndexes.forEach(function(item, index){
        unlockedElements.splice(item,0,lockedElements[index]);
    })

    array = unlockedElements;
}

/*called by shuffleSections, splitParsedMCQIntoSectionsIntoQuestions()
converts the parsed_mcq table into a nested array with the following structure:
parsed_mcq: [[section],[section],[section]...]
each section: [row,row,row,row...]
*/
function splitParsedMCQIntoSections(){
    let rows = Array.from(parsed_mcq.children);
    let sectionsByRow = [];

    rows.forEach(function(row,index){
        if (index==0) return; //skip table header
        if (row.classList.contains("section")) //if row is section header, create new section array
        {
            let section = [];
            section.push(row);
            sectionsByRow.push(section);
        }
        else //if row is a question/answer/emptyLine, add it to the current section array
        {
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
function splitIntoQuestions(section)
{
    let questions = [];

    let sectionHeader=[section[0],section[1]]; //sectionHeader array is the section header row and the subsequent empty row
    questions.push(sectionHeader);

    section.forEach(function(row, index){
        if (index==0 || index==1) return; //skip sectionHeader
        if (row.classList.contains('question')) //if row is a question, create new question array
        {
            let question = [];
            question.push(row);
            questions.push(question);
        }
        else //if row is an answer/emptyLine, add it to the current question array
        {
            let currentQuestionIndex = questions.length-1;
            questions[currentQuestionIndex].push(row);
        }
    })
    return questions;
}

/*called by shuffleQuestions(), shuffleAnswers()
converts the parsed_mcq table into a nested array with the following structure:
parsed_mcq: [[section],[section],[section]...]
each section: [[header],[question],[question]...]
each question: [row,row,row,row...]
*/
function splitParsedMCQIntoSectionsIntoQuestions()
{
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
function renumberQuestions ()
{
    let questionRows = Array.from(parsed_mcq.getElementsByClassName('question'));
    questionRows.forEach(function(item,index){
        item.children[0].textContent = index+1;
    })
}

/*called by shuffleAnswers()
overwrites letter label for first answer under each question with 'A',
second letter label under each question with 'B' etc.
*/
function reletterAnswers()
{
    let questionRows = parsed_mcq.getElementsByClassName('question');
    let letters = ['A', 'B', 'C', 'D', 'E'];

    for (let row of questionRows)
    {
        let letterIndex = 0;

        function reletterAnswer(row, letterIndex)
        {
            let nextRow = row.nextElementSibling;
            if (nextRow.classList.contains('answer')&&letterIndex<=4)
            {
                row.nextElementSibling.children[0].textContent = letters[letterIndex]; //letters[0] is 'A', letters[1] is 'B' etc
                letterIndex++;
                reletterAnswer(nextRow, letterIndex)
            }
        }
        reletterAnswer(row, letterIndex);
    }
}

/*called by parseMCQ(), shuffleSections(), shuffleQuestions(), shuffleAnswers(), addAnswerKey (), keyTd onclick
converts parsed_mcq table into output text by row
creates answer key based on checked key-column checkboxes
*/
function createOutput()
{
    output.innerHTML='';//clear output
    let rows = Array.from(parsed_mcq.children);
    let answerKey = '<p id="output_answer_key">Output Answer Key</p>';
    let copyButton = '<button onclick="copyOutput()">Copy Output</button>'

    output.insertAdjacentHTML('beforeend', copyButton+'<br><br>');

    rows.forEach(function(row, index){
        if (index==0) return;//skip table header

        let text;//parsed_mcq row converts into this output text
        if (row.classList.contains('section'))
        {
            text = row.children[1].children[0].innerHTML; //in order to include <br>
        }

        if (row.classList.contains('emptyLine'))
        {
            text = '';
        }

        if (row.classList.contains('question'))
        {
            text = before_question_number.value + row.children[0].textContent + after_question_number.value + row.children[1].children[0].innerHTML;//allows user to put HTML into input_mcq
            answerKey += parseRowForKey(index); //add correctAnswers for this question to answerKey
        }

        if (row.classList.contains('answer'))
        {
            text = before_answer_letter.value + row.children[0].textContent + after_answer_letter.value + row.children[1].children[0].innerHTML;
        }
        
        output.insertAdjacentHTML('beforeend', text+'<br>')
    })
    output.insertAdjacentHTML('beforeend', answerKey);
    output.insertAdjacentHTML('beforeend', '<br><br>'+copyButton);
}

/*called by createOutput()
returns answer key for one row with the given index
*/
function parseRowForKey(rowIndex)
{
    let rows = Array.from(parsed_mcq.children);
    let row = rows[rowIndex];
    //count how many answer options this question has
    let answers = [];
    let i=1;
    while (rows[rowIndex+i].classList.contains('answer')){
        answers.push(rows[rowIndex+i]);
        i++;
        if (i>5) break;
    }
    let correctAnswers = '';
    /*for each answer option with a checked key-column checkbox, add its letter label to correctAnswers
    this allows for multiple correct answers per question
    */
    answers.forEach(function(row){
        if (row.children[2].firstElementChild.checked){
            correctAnswers += row.children[0].textContent;
        }
    })
    //question number and letters of all correct answers for that question
    return '<br>'+row.children[0].textContent+'. '+correctAnswers;
}

//PART 3: MISCELLANEOUS FUNCTIONS

/*called by input_ak.onblur
parses input_ak textarea for user-input answer key
checks key-column checkboxes in the parsed_mcq table next to correct answers based on answer key
creates parsed_ak table based on answer key, one row per question
validates answer key and highlights rows in parsed_ak table if they have an error
*/
function addAnswerKey ()
{
    let userInput = input_ak.value.toUpperCase()+' ';//so that, for example, 'b' and 'B' answers are treated the same
    /*split userInput into an array of rawKeys.
    each rawKey is a string of one number followed by text that hopefully includes A/B/C/D/E
    */
    let rawKeys = userInput.match(/\d+\D+/g); //regex for one-or-more digits followed by one-or-more non-digits
    let rowsMCQ = Array.from(parsed_mcq.children);
    let answers = parsed_mcq.getElementsByClassName('answer');
    let parsedAkHeader = '<table id="parsed_ak">'+
                            '<tr>'+
                                '<th style="width:4ch">q</th>'+
                                '<th style="width:4ch">a</th>'+
                            '</tr>'+
                        '</table>'

    for (let answer of answers)
    {
        answer.children[2].firstElementChild.checked = false; //reset all key-column checkboxes to not checked
    }
    
    parsed_ak.outerHTML = parsedAkHeader; //reset the parsed_ak table

    //nested forEach loops: go through each rawKey and compare it to each parsed_mcq row
    rawKeys.forEach(function(rawKey){
        let number = rawKey.match(/\d+/); //regex for 1-or-more-digit number
        let rowAK = document.createElement('tr');
        let questionTdAK = document.createElement('td'); //Td for Question # in parsed_ak
        let answerTdAK = document.createElement('td'); //Td for correct Answer letter(s) in parsed_ak

        questionTdAK.textContent = number;

        let correctAnswerIndexes = []; //used later for rowsMCQ[index+correctAnswerIndex]
        let ABCDE = ['random filler','A','B','C','D','E']
        ABCDE.forEach(function(letter,index){
            if (rawKey.includes(letter))
            {
                correctAnswerIndexes.push(index);
                answerTdAK.textContent+=letter;
            }
        })

        rowAK.append(questionTdAK);
        rowAK.append(answerTdAK);
        parsed_ak.append(rowAK);

        let matchCount = 0;//number of times question number from answer key is found in parsed_mcq question numbers
        if (correctAnswerIndexes.length>0)
        {
            rowsMCQ.forEach(function(rowMCQ, index){
                if (!rowMCQ.classList.contains('question')) return;

                if (rowMCQ.children[0].textContent == number) //for each MCQ row that has a question, check if it matches the number in the current rawKey
                {
                    matchCount++;
                    correctAnswerIndexes.forEach(function(correctAnswerIndex){
                        /*in parsed_mcq table, A is (question-row index)+1, B is (question-row index)+2 etc
                        correctAnswerIndexes array sets A to 1, B to 2 etc
                        so index+correctAnswerIndex is the parsed_mcq-index of the correct answer
                        */
                        if (rowsMCQ[index+correctAnswerIndex].classList.contains('answer'))
                        {
                            rowsMCQ[index+correctAnswerIndex].children[2].firstElementChild.checked = true;
                        }
                        else //error type 1: answer letter not found in question (e.g. 'D' can't be an answer to true/false question)
                        {
                            rowAK.className = 'error';
                        }
                    })
                }
            })
        }
        else //error type 2: user forgot to include answer letter
        {
            rowAK.className = 'error';
        }

        if (matchCount != 1) //error type 3: question number from answer key not found in parsed_mcq or found more than once
        {
            rowAK.className = 'error';
        }
    })
    createOutput();
    go_to_step_3_button.style.display = 'block';
}

function toggleSampleMcq(){
    let sampleMcq = 
    'Click here, then click outside of this text area to begin processing these sample MCQs.\n'+
    'The questions in this first section\n'+
    '     refer to Star Wars.\n'+
    '    \n'+
    '1. Darth Vader would enjoy a long walk on the beach. \n'+
    '     a) true\n     '+
    ' B. false\n'+
    '    \n'+
    '3)  Select <u><b><i>all</i></b></u> characters who were secretly Sith Lords.  \n'+
    '    (A Chancellor Palpatine\n'+
    '      b.    Mace Windu\n'+
    '.C.  Chancellor Valorum\n'+
    'd. Jar Jar Binks\n'+
    '\n'+
    '  The questions in Section 3 refer to the Simpsons.\n'+
    '\n'+
    ' \n'+
    '      5 <p>Who shot Mr. Burns?</p> <img src="https://upload.wikimedia.org/wikipedia/en/5/56/Mr_Burns.png" style="max-width:50%; max-height:50%; width:90px; height:150px">  \n'+
    '    a. Lisa\n'+
    'b Marge\n'+
    'c. Bart\n'+
    'D Homer\n'+
    '(E.) Maggie\n'+
    '        \n'+
    '(6) Which of the following characters<br>is left-handed?\n'+
    '    a Seymour Skinner\n'+
    ' B Ned Flanders\n'+
    ' c) Moe Szyslak\n'+
    'D all of the above\n'

    if (sample_mcq_button.innerHTML == 'Enter sample MCQ')
    { 
        input_mcq.value = sampleMcq;
        sample_mcq_button.innerHTML = 'Remove sample MCQ';
    }
    else
    {
        input_mcq.value = '';
        sample_mcq_button.innerHTML = 'Enter sample MCQ';
    }
}

function toggleSampleAk()
{
    let sampleAk = 'Click here, then click outside of this text area to begin processing this sample answer key.\n'+
    '1 bd5 e\n'+
    '   3. a,,d \n'+
    '22 is fa\n'+
    '6====    \n'

    if (sample_ak_button.innerHTML === 'Enter sample answer key')
    { 
        input_ak.value = sampleAk;
        sample_ak_button.innerHTML = 'Remove sample answer key';
    }
    else
    {
        input_ak.value = '';
        sample_ak_button.innerHTML = 'Enter sample answer key';
    }
}

function toggle(element, display='block')
{

    if(window.getComputedStyle(element).display === 'none')
    {
        element.style.display = display;
    }
    else
    {
        element.style.display = 'none';
    }
}

/*runs when page is loaded
shows an error message to users with IE browsers
*/
function detectIE()
{
    let ie10andbelow = window.navigator.userAgent.indexOf('MSIE') != -1;
    let ie11andabove = window.navigator.userAgent.indexOf('Trident') != -1;
    let browserError ='<p id="browserError">This website does not work with Internet Explorer 11 or older.<br>Get a better browser.</p>';
    if (ie10andbelow || ie11andabove)
    {
        document.body.innerHTML += browserError;
    }
}

function toggleBlockType (firstRow){

}

function copyOutput() {
    var range = document.createRange();
    var selection = window.getSelection();
    range.selectNodeContents(document.getElementById('output'));

    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
}

function goToStep(step){
    input_mcq_div.style.display = 'none';
    ak_div.style.display = 'none';
    output_div.style.display = 'none';
    input_mcq_div_nav.classList.remove('active');
    ak_div_nav.classList.remove('active');
    output_div_nav.classList.remove('active');
    parse_mcq_button.style.display = 'none';
    go_to_step_2_button.style.display = 'none';
    parse_ak_button.style.display = 'none';
    go_to_step_3_button.style.display = 'none';
    shuffle_sections_button.style.display = 'none';
    shuffle_questions_button.style.display = 'none';
    shuffle_answers_button.style.display = 'none';

    if (step === 1)
    {
        input_mcq_div.style.display = 'block';
        input_mcq_div_nav.classList.add('active');
        parse_mcq_button.style.display = 'block';
    }

    if (step === 2)
    {
        ak_div.style.display = 'grid';
        ak_div_nav.classList.add('active');
        parse_ak_button.style.display = 'block';
    }

    if (step === 3)
    {
        output_div.style.display = 'block';
        output_div_nav.classList.add('active');
        shuffle_sections_button.style.display = 'block';
        shuffle_questions_button.style.display = 'block';
        shuffle_answers_button.style.display = 'block';
    }
};
