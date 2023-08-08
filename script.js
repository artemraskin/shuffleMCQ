'use strict';

//Parse user input from input_mcq textarea. Build/validate parsed_mcq table.
function parseMcq()
{
    clear('parsed_mcq');
    let previousRow;
    let rowId = 0;

    const userInput = input_mcq.value.trim().replace(/[\u000a\u000b\u000c\u000d\u0085\u2028\u2029]/g, "\n"); //replace various Unicode codes for new line with a regular new line
    if (!userInput) return input_mcq.select();
    const labelChars = label_chars.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/, '');

    const blocks = userInput.split(/\n\s*\n/); //split by empty line
    blocks.forEach(parseBlock);

    validateParsedMcq();
    createOutput();

    //helper functions:

    function parseBlock(block, index)
    {
        if (isNum(getLabel(block))) //question block
        {
            if (index==0) //second row must be a section header, otherwise splitParsedMcqIntoSections() breaks
            {
                previousRow = createRow('S', '');
                createRow('', '');
            }

            try{ parseQuestionBlock(block); }
            catch(err){ previousRow = createRow('error', block); }
            
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
        const re = new RegExp ('[' + labelChars + ']', 'g');
        const label = splitOffLabel(text).replace(re, ''); //turn (10) and B. into 10 and B
        //const label = splitOffLabel(text).replace(/[\)\(\.]/g, '');
        if (isNum(label)) return +label; //if text starts with a 1-2-or-3-digit number, return question number
        if (isABCDE(label)) return label.toUpperCase(); //if text starts with A/B/C/D/E, return answer letter
        return 'error';
    }

    //split question block into question and answers, pass to createRow()
    function parseQuestionBlock(block)
    {
        const re = new RegExp ('\\n' + '(?=' + '[\\s'+labelChars+']*' + '[abcde]' + '[\\s'+labelChars+']*' + '\\s' + ')', 'i'); // default: /\n(?=[\s\)\(\.]*[abcde][\s\)\(\.]*\s)/i
        const questionAndAnswers = block.trim().split(re); //split by newline followed by answer label
        for (let q_or_a of questionAndAnswers){        
            previousRow = createRow
            (
                getLabel(q_or_a),
                splitOffLabel(q_or_a, true) //remove label
            )
        }
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
        if (label==='') row.className = 'empty_line';
        if (isNum(label)) row.className = 'question';
        if (isABCDE(label)) row.className = 'answer';
        if (label==='error') row.className = 'error';

        rowId++;
        row.id = rowId;
        textDiv.className = 'parsed_mcq_cell_div';
        textDiv.innerHTML = '<a>'+text.replace(/\n/g, "<br>")+'</a>';
        textTd.append(textDiv);
        labelTd.textContent = label;

        if (row.className == 'answer')
        {
            keyTd.insertAdjacentHTML('afterbegin','<input type="checkbox" onclick=createOutput() name="key'+rowId+'"><br>');
        }

        if (row.className != 'empty_line')
        {
            lockTd.insertAdjacentHTML('afterbegin','<input type="checkbox" name="lock'+rowId+'"><br>');
        }

        row.append(labelTd);
        row.append(textTd);
        row.append(keyTd);
        row.append(lockTd);

        parsed_mcq.append(row);

        return row;
    }

    // check if the parsed_mcq table follows expected pattern, such as ' S #ABCD #ABCD S #ABCDE #AB #ABC S #ABCD  '
    function validateParsedMcq ()
    {
        const rows = Array.from(parsed_mcq.children);
        let firstErrorRow = false;

        rows.forEach (function(row, index, array){
            if (index === 0) return; //skip table header
            if (index === rows.length-1) return; //skip last row, which is empty

            const label = row.children[0].textContent;

            const previousLabel = (index > 1)
                ? array[index-1].children[0].textContent
                : ''; //table header has no label

            const nextLabel = array[index+1].children[0].textContent;

            const nextNextLabel = (index < rows.length - 2)
                ? array[index + 2].children[0].textContent
                : ''; //2nd-to-last row has no next-next row

            if (label==='S') //sections may only occur in the middle of a ' S #' pattern
            {
                if (previousLabel!=='' || nextLabel!=='' || !isNum(nextNextLabel)) row.className='error';
            }
            
            if (label==='') //empty lines should not occur in the middle of a '#ABCD' pattern
            {
                if (previousLabel==='A' || isNum(previousLabel) ||  isABCDE(nextLabel)) row.className='error';
            }
            
            if (isNum(label)) //questions may only occur in the middle of a ' #A' pattern
            {
                if (previousLabel!=='' || nextLabel!=='A') row.className='error';
            }

            if (label==='A') //'A' answers may only occur in the middle of a '#AB' pattern
            {
                if (!isNum(previousLabel) || nextLabel!=='B') row.className='error';
            }

            if (label==='B') //'B' answers may only occur in the middle of 'ABC' or 'AB ' patterns 
            {
                if (previousLabel!=='A' || (nextLabel!=='C' && nextLabel!=='')) row.className='error';
            }

            if (label==='C') //'C' answers may only occur in the middle of 'BCD' or 'BC ' patterns
            {
                if (previousLabel!=='B' || (nextLabel!=='D' && nextLabel!=='')) row.className='error';
            }

            if (label==='D') //'D' answers may only occur in the middle of 'CDE' or 'CD ' patterns
            {
                if (previousLabel!=='C' || (nextLabel!=='E' && nextLabel!=='')) row.className='error';
            }

            if (label==='E') //'E' answers may only occur in the middle of a 'DE ' pattern
            {
                if (previousLabel!=='D' || nextLabel!=='') row.className='error';
            }

            if (!firstErrorRow)
            {
                if (label==='error') firstErrorRow = row.id;
                if (row.className === 'error') firstErrorRow = row.id;
            }
        })

        updateMiddleButtons(firstErrorRow);
    }

    function updateMiddleButtons(firstErrorRow)
    {
        if (firstErrorRow)
        {
            go_to_step_2_button.style.display = 'none';
            parse_mcq_button.innerHTML = 'Fix<br>Error';
            document.getElementById(firstErrorRow).scrollIntoView( {behavior: 'smooth', block: 'center'} );
        }
        else
        {
            go_to_step_2_button.style.display = 'block';
            parse_mcq_button.innerHTML = 'Parse<br>MCQ</a>';
        }
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
}

//Parse user input from input_ak textarea. Build/validate parsed_ak table. Populate key-column in parsed_mcq table.
function parseAk()
{
    const userInput = input_ak.value.toUpperCase();
    if(!userInput) return input_ak.select();
    const rawKeys = (userInput+' ').match(/\d+\D+/g) || [userInput]; //Split userInput into array of rawKey strings. Each rawKey is one number followed by text (or by ' ' if userInput ends with a number)
    const rowsMcq = Array.from(parsed_mcq.children);
    const answers = parsed_mcq.getElementsByClassName('answer');
    let validAk = true;
    let numbers=[];

    for (let answer of answers) answer.children[2].firstElementChild.checked = false; //reset all key-column checkboxes to not checked
    clear('parsed_ak');

    //nested forEach loops: go through each rawKey and compare it to each parsed_mcq row
    rawKeys.forEach(function(rawKey){        
        const rowAk = document.createElement('tr');
        const questionTdAk = document.createElement('td');
        const answerTdAk = document.createElement('td');
        const errorMessageTdAk = document.createElement('td');
        const number = rawKey.match(/\d+/) ? rawKey.match(/\d+/)[0] : '';
        questionTdAk.textContent = number;

        let correctAnswers = []; //A=1, B=2, etc.
        ['index 0','A','B','C','D','E'].forEach(function(letter,index){
            if (rawKey.includes(letter))
            {
                correctAnswers.push(index);
                answerTdAk.textContent+=letter;
            }
        })

        rowAk.append(questionTdAk);
        rowAk.append(answerTdAk);
        rowAk.append(errorMessageTdAk);
        parsed_ak.append(rowAk);

        if (!number) return setError('no number in key', rowAk);
        if (correctAnswers.length === 0) return setError('no letter in key', rowAk);
        if (numbers.includes(number)) return setError('duplicate # in key', rowAk);
        numbers.push(number);

        let matchCount = 0; //number of times question number from answer key is found in parsed_mcq question numbers

        rowsMcq.forEach(function(rowMcq, qRowId){
            if (!rowMcq.classList.contains('question')) return;

            if (rowMcq.children[0].textContent == number) //for each Mcq row that has a question, check if it matches the number in the current rawKey
            {
                matchCount++;
                for (let correctAnswer of correctAnswers){
                    const correctAnswerRowId = qRowId + correctAnswer; //In parsed_mcq, (rowId of C) = (rowId of Q) + 3. In correctAnswers, C = 3
                    if (!rowsMcq[correctAnswerRowId].classList.contains('answer')){
                        return setError('letter not in MCQ', rowAk); //e.g. answer D for 'true or false' Q
                    }
                    rowsMcq[correctAnswerRowId].children[2].firstElementChild.checked = true;
                }
            }
        })

        if (matchCount === 0) return setError('# not in MCQ', rowAk);
        if (matchCount > 1) return setError('duplicate # in MCQ', rowAk);
    })

    createOutput();
    parse_ak_button.innerHTML = validAk ? 'Parse<br>Key' : 'Fix<br>Error';

    function setError(message, rowAk)
    {
        rowAk.className = 'error';
        rowAk.children[2].innerHTML = message;
        validAk = false;
    }
}

function shuffle(mode)
{
    if (mode==='sections') shuffleSections();
    if (mode==='questions') shuffleQuestions();
    if (mode==='answers') shuffleAnswers();

    //shuffle sections in the parsed_mcq table, keep question order within each section intact
    function shuffleSections()
    {
        const sectionsByRow = splitParsedMcqIntoSections();

        /*lockedIndexes will be an argument in shuffleArray() - locked sections stay in place when rest of sections are shuffled.
        Section indexes are not the same as row indexes - 1st section has index 0, 2nd section has index 1, etc.
        */
        let lockedIndexes = [];
        /*A section header is the first row of the section,
        i.e. the section not including its empty line(s), question(s), and answers.
        */
        const sectionHeaders = Array.from(parsed_mcq.getElementsByClassName('section'));
        sectionHeaders.forEach(function(header,index){
            if (header.children[3].firstElementChild.checked) //user locks a section by checking the lock-column checkbox next to its header
            {
                lockedIndexes.push(index);
            }
        })

        shuffleArray(sectionsByRow, lockedIndexes);
        
        clear('parsed_mcq');

        const rows = sectionsByRow.flat(1); //sectionsByRow array has a depth of 1
        for (let row of rows) parsed_mcq.append(row);

        renumberQuestions(); // question #s are out of order because sections were shuffled
        createOutput();
    }

    //shuffle questions in the parsed_mcq table within their respective sections, keep answer order within each question intact
    function shuffleQuestions()
    {
        const sectionsByQuestion = splitParsedMcqIntoSectionsIntoQuestions();

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

        clear('parsed_mcq');

        const rows = sectionsByQuestion.flat(2); //sectionsByQuestion has a depth of 2
        for (let row of rows) parsed_mcq.append(row);
  
        renumberQuestions(); //question #s are out of order because questions were shuffled
        createOutput();
    }

    //shuffle answer options in the parsed_mcq table within their respective questions
    function shuffleAnswers(table)
    {
        const sectionsByQuestion = splitParsedMcqIntoSectionsIntoQuestions(); //depth = 2
        const tableByQuestion = sectionsByQuestion.flat(1); //[[S],[Q],[Q],[S],[Q]...] [Q]=[row, row, row...]

        tableByQuestion.forEach(function(question){
            if (question[0].classList.contains("section")) return; //skip section headers
            /*lockedIndexes will be an argument in shuffleArray() - locked answers stay in place when rest of answers are shuffled.
            Answer indexes are not the same as row indexes - 1st answer of each question has index 0.
            question[0] is the question itself, not one of the answers, so it should be auto-locked.
            */
            let lockedIndexes = [0];
            question.forEach(function(answer, index)
            {
                if (index==0 || index==question.length-1) return; //skip first row (question) and last row (empty line)
                if (answer.children[3].firstElementChild.checked) //user locks an answer by checking the lock-column checkbox next to it
                {
                    lockedIndexes.push(index);
                }
            })
            lockedIndexes.push(question.length-1);
            shuffleArray(question,lockedIndexes);  
        })

        clear('parsed_mcq');

        const rows = tableByQuestion.flat(1);
        for (let row of rows) parsed_mcq.append(row);

        reletterAnswers(); //answer letter labels are out of order because answers were shuffled
        createOutput();
    }

    //Shuffle array in place, skipping elements with [lockedIndexes]. [lockedIndexes] must be in ascending order.
    function shuffleArray(array, lockedIndexes)
    {
        let unlockedElements = array; //elements in the passed array that should be shuffled
        let lockedElements = []; //elements in the passed array that should not be shuffled
        for (let i of lockedIndexes) lockedElements.push(array[i]); //add locked elements to the lockedElements array

        //TODO splice returns deleted items, use that to rewrite this code
        for (let i = lockedIndexes.length-1; i>=0; i--) //loop from end to start. if loop from start to end, indexes will shift when element is deleted
        {
            let lockedIndex = lockedIndexes[i];
            unlockedElements.splice(lockedIndex,1); //remove locked elements from the unlockedElements array
        }

        for (let i = unlockedElements.length - 1; i > 0; i--)
        {
            const j = Math.floor(Math.random() * (i + 1));
            [unlockedElements[i], unlockedElements[j]] = [unlockedElements[j], unlockedElements[i]]; //shuffle unlockedElements
        }

        lockedIndexes.forEach(function(item, index){
            unlockedElements.splice(item,0,lockedElements[index]); //return locked elements back into their original array indexes
        })

        array = unlockedElements;
    }

    //parsed_mcq=[[S],[S],[S]...]   [S]=[row,row,row,row...]
    function splitParsedMcqIntoSections()
    {
        const rows = Array.from(parsed_mcq.children);
        let sectionsByRow = [];

        rows.forEach(function(row,index){
            if (index==0) return; //skip table header

            if (row.classList.contains('section')) //if row is section header, create new section array
            {
                let section = [];
                section.push(row);
                sectionsByRow.push(section);
            }
            else //if row is a question/answer/empty line, add it to the current section array
            {
                let currentSectionIndex = sectionsByRow.length-1;
                sectionsByRow[currentSectionIndex].push(row);
            }
        })
        return sectionsByRow;
    }

    //[S]=[row,row,row,row...]   =>   [S]=[[header],[Q],[Q]...] [Q]=[row,row,row,row...]
    function splitIntoQuestions(section)
    {
        let questions = [];
        const sectionHeader = [section[0],section[1]]; //[header, emptyrow]
        questions.push(sectionHeader);

        section.forEach(function(row, index){
            if (index==0 || index==1) return; //skip sectionHeader

            if (row.classList.contains('question')) //if row is a question, create new question array
            {
                let question = [];
                question.push(row);
                questions.push(question);
            }
            else //if row is an answer/empty line, add it to the current question array
            {
                const currentQuestionIndex = questions.length-1;
                questions[currentQuestionIndex].push(row);
            }
        })

        return questions;
    }

    //parced_mcq=[[S],[S],[S]...]  [S]=[[header],[Q],[Q]...]  [Q]=[row,row,row,row...]
    function splitParsedMcqIntoSectionsIntoQuestions()
    {
        let sectionsByRow = splitParsedMcqIntoSections();
        let sectionsByQuestion = [];

        sectionsByRow.forEach(function(section){
            sectionsByQuestion.push(splitIntoQuestions(section));  
        })
        return sectionsByQuestion;
    }

    //overwrite questions #s in the label column with 1,2,3...n
    function renumberQuestions()
    {
        let questionRows = Array.from(parsed_mcq.getElementsByClassName('question'));
        questionRows.forEach(function(item,index){
            item.children[0].textContent = index+1;
        })
    }

    //overwrite letter label for first answer under each question with 'A', second letter label with 'B' etc.
    function reletterAnswers()
    {
        const questionRows = parsed_mcq.getElementsByClassName('question');
        const letters = ['A', 'B', 'C', 'D', 'E'];

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
}

//Convert parsed_mcq table to output text. Create answer key based on key-column checkboxes
function createOutput()
{
    output.innerHTML = ''; //clear output
    let rows = Array.from(parsed_mcq.children);
    let answerKey = '<p id="output_ak">Answer Key</p>';
    let copyButton = '<button onclick="copyOutput()">Copy Output</button>'

    output.insertAdjacentHTML('beforeend', copyButton+'<br><br>');

    rows.forEach(function(row, index){
        if (index==0) return;//skip table header

        let text;//parsed_mcq row converts into this output text
        if (row.classList.contains('section'))
        {
            text = row.children[1].children[0].innerHTML; //in order to include <br>
        }

        if (row.classList.contains('empty_line'))
        {
            text = '';
        }

        if (row.classList.contains('question'))
        {
            text = before_q.value + row.children[0].textContent + after_q.value + row.children[1].children[0].innerHTML; //allows user to put HTML into input_mcq
            answerKey += parseRowForKey(index); //add correctAnswers for this question to answerKey
        }

        if (row.classList.contains('answer'))
        {
            text = before_a.value + row.children[0].textContent + after_a.value + row.children[1].children[0].innerHTML;
        }
        
        output.insertAdjacentHTML('beforeend', text+'<br>')
    })
    output.insertAdjacentHTML('beforeend', answerKey);
    output.insertAdjacentHTML('beforeend', '<br><br>'+copyButton);

    //return answer key for one row with the given index
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
}

function copyOutput() {
    var range = document.createRange();
    var selection = window.getSelection();
    range.selectNodeContents(document.getElementById('output'));

    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
}

function clear(table_name){
    if (table_name === 'parsed_mcq')
    {
        parsed_mcq.outerHTML = '<table id="parsed_mcq" style="display:table">'+
                                    '<tr id="0">'+
                                        '<th style="width:5ch">label</th>'+
                                        '<th>text</th>'+
                                        '<th style="width:4ch">key</th>'+
                                        '<th style="width:4ch">lock</th>'+
                                    '</tr>'+
                                '</table>';
        border_mimic.style.display = 'none';
        user_guide.style.display = 'none';
    }

    if (table_name === 'parsed_ak')
    {
        parsed_ak.outerHTML = '<table id="parsed_ak">'+
                                    '<tr>'+
                                        '<th>q</th>'+
                                        '<th>a</th>'+
                                        '<th></th>'+
                                    '</tr>'+
                                '</table>'
    }
}

function enterSampleMcq(){
    const sample1 = 
    'The questions in this section refer to Star Wars.\n'+
    '\n'+
    '(1) Darth Vader would enjoy a long walk on the beach. \n'+
    'A. true\n'+
    'B. false\n'+
    '\n'+
    '(2) Select all characters who were secretly Sith Lords.  \n'+
    'A. Chancellor Palpatine\n'+
    'B. Mace Windu\n'+
    'C. Chancellor Valorum\n'+
    'D. Jar Jar Binks\n'+
    '\n'+
    'The questions in this section refer to the Simpsons.\n'+
    '\n'+
    '(4) Who shot Mr. Burns?\n'+
    'A. Lisa\n'+
    'B. Marge\n'+
    'C. Bart\n'+
    'D Homer\n'+
    'E. Maggie\n'+
    '\n'+
    '(5) Which of the following characters is left-handed?\n'+
    'A. Seymour Skinner\n'+
    'B. Ned Flanders\n'+
    'C. Moe Szyslak\n'+
    'D. all of the above\n';

    const sample2 = 
    'The questions in this section\n'+
    '     refer to <span style="color:red">Star Wars</span>.\n'+
    '    \n'+
    '1. Darth Vader would \n'+
    'enjoy a long walk on the beach. \n'+
    '     a) true\n     '+
    ' B. false\n'+
    '    \n'+
    '2)  Select <u><b><i>all</i></b></u> characters who were secretly Sith Lords.  \n'+
    '    (A Chancellor\n'+
    'Palpatine\n'+
    '      b.    Mace Windu\n'+
    '.C.  Chancellor Valorum\n'+
    'd. Jar Jar Binks\n'+
    '\n'+
    '2)  [This will create error in answer key] Select <u><b><i>all</i></b></u> characters who were secretly Sith Lords.  \n'+
    '    (A Chancellor Palpatine\n'+
    '      b.    Mace Windu\n'+
    '.C.  Chancellor Valorum\n'+
    'd. Jar Jar Binks\n'+
    '\n'+
    '  The questions in this section refer to the Simpsons.\n'+
    '\n'+
    ' \n'+
    '      4 <p>Who shot Mr. Burns?</p> <img src="https://upload.wikimedia.org/wikipedia/en/5/56/Mr_Burns.png" style="max-width:50%; max-height:50%; width:90px; height:150px">  \n'+
    '    a. Lisa\n'+
    'b Marge\n'+
    'c. Bart\n'+
    'D Homer\n'+
    '(E.) Maggie\n'+
    '        \n'+
    '(5) Which of the following characters<br><br>is left-handed?\n'+
    '    a Seymour Skinner\n'+
    ' B Ned Flanders\n'+
    ' c) Moe Szyslak\n'+
    'D all of the above\n';

    const sample3 = 
    'The questions in this section refer to Star Wars.\n'+
    '\n'+
    '(1) Darth Vader would enjoy a long walk on the beach. \n'+
    'B. true\n'+
    'B. false\n'+
    '\n'+
    '(2) Select all characters who were secretly Sith Lords.  \n'+
    'A. Chancellor Palpatine\n'+
    'B. Mace Windu\n'+
    'D. Chancellor Valorum\n'+
    'C. Jar Jar Binks\n'+
    '\n'+
    'The questions in this section refer to the Simpsons.\n'+
    '\n'+
    '\n'+
    '(3) Question with error\n'+
    'A. only one answer option\n'+
    '(4) Who shot Mr. Burns?\n'+
    'A. Lisa\n'+
    'B. Marge\n'+
    'C. Bart\n'+
    'D Homer\n'+
    'E. Maggie\n'+
    '\n'+
    '(5) Which of the following characters is left-handed?\n'+
    'A. Seymour Skinner\n'+
    'B. Ned Flanders\n'+
    'C. Moe Szyslak\n'+
    'D. all of the above\n';

    if (sample_mcq.value == 0) input_mcq.value = '';
    if (sample_mcq.value == 1) input_mcq.value = sample1;
    if (sample_mcq.value == 2) input_mcq.value = sample2;
    if (sample_mcq.value == 3) input_mcq.value = sample3;
}

function enterSampleAk()
{
    const sample1 =
    '1. B\n'+
    '2. AC\n'+
    '4. E\n'+
    '5. B\n';

    const sample2 =
    '1 b2 a,c\n'+
    '   4. E \n'+
    '5 is B\n';

    const sample3 =
    '1. C\n'+
    '2. AC\n'+
    '4. \n'+
    '5. F\n'+
    '10. B\n'+
    '2. B\n';

    if (sample_ak.value == 0) input_ak.value = '';
    if (sample_ak.value == 1) input_ak.value = sample1;
    if (sample_ak.value == 2) input_ak.value = sample2;
    if (sample_ak.value == 3) input_ak.value = sample3;
}

function toggle(element, display='block', hide=true)
{
    if (element == parsed_mcq) return; //toggle user_guide instead

    if(window.getComputedStyle(element).display == 'none')
    {
        element.style.display = display;
    }
    else if(hide)
    {
        element.style.display = 'none';
    }

    if(window.getComputedStyle(user_guide).display == 'none') parsed_mcq.style.display = 'table';
    if(window.getComputedStyle(user_guide).display == 'block') parsed_mcq.style.display = 'none';
    if (element == user_guide) toggle (border_mimic, 'block', hide);
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
        input_mcq.select();
    }

    if (step === 2)
    {
        ak_div.style.display = 'grid';
        ak_div_nav.classList.add('active');
        parse_ak_button.style.display = 'block';
        go_to_step_3_button.style.display = 'block';
        input_ak.select();
    }
    if (step === 3)
    {
        output_div.style.display = 'block';
        output_div_nav.classList.add('active');
        shuffle_sections_button.style.display = 'block';
        shuffle_questions_button.style.display = 'block';
        shuffle_answers_button.style.display = 'block';
    }
}

function highlightVocab(){
    const allElements = document.querySelectorAll('#vocab_div *');
    for (let e of allElements) e.classList.remove('vocab_highlight');

    const selectedElements = document.getElementsByClassName(vocab.value);
    for (let element of selectedElements) element.classList.add('vocab_highlight');
}

function selectVocab(target){
    vocab.value = target;
    highlightVocab();
}

function clearValue(input){
    document.getElementById(input).value = '';
}

//Show error message to users with IE browsers
(function detectIE()
{
    const ua = window.navigator.userAgent;
    const ie10andbelow = ua.indexOf('MSIE') != -1; // ua.match(/MSIE/i);
    const ie11andabove = ua.indexOf('Trident') != -1;
    const browserError = '<p id="browserError">This website does not work with Internet Explorer 11 or older.<br>Get a better browser.</p>';
    if (ie10andbelow || ie11andabove) return document.body.innerHTML += browserError;
})(); //Run when page is loaded.

function test(mode=1){
    setTimeout(() => sample_mcq.value = mode, 3000);
    setTimeout(() => sample_mcq.onchange(), 4000);
    setTimeout(() => parse_mcq_button.click(), 6000);
    setTimeout(() => go_to_step_2_button.click(), 9000);
    setTimeout(() => sample_ak.value = mode, 12000);
    setTimeout(() => sample_ak.onchange(), 13000);
    setTimeout(() => parse_ak_button.click(), 15000);
    setTimeout(() => go_to_step_3_button.click(), 18000);
    setTimeout(() => shuffle_sections_button.click(), 21000);
    setTimeout(() => shuffle_questions_button.click(), 24000);
    setTimeout(() => shuffle_answers_button.click(), 27000);
    setTimeout(() => copyOutput(), 30000);
}
