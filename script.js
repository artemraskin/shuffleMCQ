'use strict';

//custom convert pasted HTML to plain text, then paste it into input_mcq
function handlePaste (e)
{
    if (input_mode.value == 'plain') return;
    e.preventDefault();
    
    pasted.innerHTML = (e.clipboardData).getData('text/html') || (e.clipboardData).getData('text/plain');
    
    for (const el of pasted.querySelectorAll('img'))
    {
        const counter = parseInt(images_counter.innerHTML) + 1;
        images_counter.innerHTML = counter;
        const clone = el.cloneNode(true);
        clone.id = 'image' + counter;
        clone.removeAttribute('style');
        images.appendChild(clone);
        el.replaceWith(document.createTextNode("IMАGE " + counter)); //cyrillic А
    }

    for (const el of pasted.querySelectorAll('table'))
    {
        const counter = parseInt(tables_counter.innerHTML) + 1;
        tables_counter.innerHTML = counter;
        const clone = el.cloneNode(true);
        clone.id = 'table' + counter;
        tables.appendChild(clone);
        el.replaceWith(document.createTextNode("TАBLE " + counter)); //cyrillic А
    }

    for (const el of pasted.querySelectorAll('br'))
    {
        el.outerHTML = 'LINEBREАK'; //cyrillic А
    }

    for (const el of pasted.querySelectorAll('ol'))
    {
        const letteredItems = el.querySelectorAll('li[style*="list-style-type:upper-alpha"], li[style*="list-style-type:lower-alpha"]');
        const letterCode = 'A'.charCodeAt(0);
        letteredItems.forEach((li, index) => {
            if (li.parentElement != el) return;
            const letter = String.fromCharCode(index + letterCode);
            li.textContent = letter + ". " + li.textContent;
        });

        const numberedItems = el.querySelectorAll('li[style*="list-style-type:decimal"]');
        numberedItems.forEach((li, index) => {
            if (li.parentElement != el) return;
            li.textContent = index + 1 + ". " + li.textContent;
        });
    }

    for (const el of pasted.getElementsByTagName('*'))
    {
        const displayType = window.getComputedStyle(el).getPropertyValue('display');
        if (['block','list-item'].includes(displayType)) el.innerHTML += 'LINEBREАK'; //cyrillic А
    };

    //paste
    const start = input_mcq.selectionStart;
    const end = input_mcq.selectionEnd;
    const current = input_mcq.value;
    const added = pasted.textContent.replaceAll('LINEBREАK','\n'); //cyrillic А
    const combined = current.substring(0, start) + added + current.substring(end);
    input_mcq.value = combined;
    input_mcq.setSelectionRange(start + added.length, start + added.length); //move cursor
}

//Parse user input from input_mcq textarea. Build/validate parsed_mcq table.
function parseMcq()
{
    const userInput = input_mcq.value.trim().replace(/[\u000a\u000b\u000c\u000d\u0085\u2028\u2029]/g, "\n"); //replace various Unicode codes for new line with a regular new line
    
    if (!userInput) return input_mcq.select();

    reset('parsed_mcq');
    let previousRow;
    let rowId = 0;

    const blocks = userInput.split(/\n\s*\n/); //split by empty line
    blocks.forEach(parseBlock);

    const firstErrorRow = validateParsedMcq();
    updateMiddleButtons(firstErrorRow);
    createOutput();
    showGoToStep(2);

    //helper functions:

    function parseBlock(block, index)
    {
        const startsWithQuestionNumber = new RegExp ('^' + '(?=' + toRegex(q_prefix) + '\\d{1,3}' + toRegex(q_postfix) + ')', 'i');

        if (startsWithQuestionNumber.test(block))
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
            if (index>0 && previousRow.classList.contains('section')) //merge consecutive section header blocks into one section header
            {
                previousRow.children[2].children[0].innerHTML += "<br><br>" + restoreHtml (block);
            }
            else
            {
                previousRow = createRow('S', block);
                createRow('', '');
            }
        }
    }

    //split question block into question and answers, pass to createRow()
    function parseQuestionBlock(block)
    {
        const questionLabel = new RegExp (toRegex(q_prefix) + '(\\d{1,3})' + toRegex(q_postfix), 'i');
        const questionNumber = block.match(questionLabel)[2];
        block = block.replace(questionLabel, '');

        const beforeAnswerLabel = new RegExp ('(?=' + toRegex(a_prefix, 'non-capturing') + '[abcde]' + toRegex(a_postfix, 'non-capturing') + ')', 'i');
        const answers = block.split(beforeAnswerLabel);
        const questionText = answers.splice(0,1)[0];
        previousRow = createRow(questionNumber, questionText);

        for (let answer of answers)
        {    
            const answerLabel = new RegExp (toRegex(a_prefix) + '([abcde])' + toRegex(a_postfix), 'i');
            const answerLetter = answer.match(answerLabel)[2].toUpperCase();
            const answerText = answer.replace(answerLabel, '');
            previousRow = createRow (answerLetter, answerText)
        }
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
        const numTd = document.createElement('td');

        if (label==='S') row.classList.add('section');
        if (label==='') row.classList.add('empty_line');
        if (isNum(label)) row.classList.add('question');
        if (['A','B','C','D','E'].includes(label)) row.classList.add('answer');

        rowId++;
        row.id = rowId;
        textDiv.classList.add('parsed_mcq_cell_div');
        textDiv.innerHTML = restoreHtml (text);
        textTd.append(textDiv);
        labelTd.textContent = label;
        if (isNum(label)) numTd.textContent = label;

        if (row.classList.contains('answer'))
        {
            keyTd.insertAdjacentHTML('afterbegin','<input type="checkbox" onclick="createOutput(); showGoToStep(3);" name="key'+rowId+'"><br>');
        }

        if (!row.classList.contains('empty_line'))
        {
            lockTd.insertAdjacentHTML('afterbegin','<input type="checkbox" name="lock'+rowId+'"><br>');
        }

        row.append(labelTd);
        row.append(numTd);
        row.append(textTd);
        row.append(keyTd);
        row.append(lockTd);
        parsed_mcq.append(row);

        return row;
    }

    function restoreHtml (text)
    {            
        text = text.replaceAll('\n', "<br>");

        function replacer(match)
        {
            const pastedHtml = document.getElementById(match);
            return pastedHtml ? pastedHtml.outerHTML : match;
        }    
        text = text.replaceAll('TАBLE ','table'); //cyrillic А
        text = text.replaceAll (/table\d+/g, replacer);
        //replace tables before images, in case image inside table
        text = text.replaceAll('IMАGE ','image'); //cyrillic А
        text = text.replaceAll (/image\d+/g, replacer);

        return text;
    }

    function toRegex(label_table, mode=false)
    {
        const rows = Array.from(label_table.rows);
        rows.pop(); //remove the + row
        const formats = [];
        for (const row of rows) formats.push(replaceSpecialChars(row.children[0]));
        if (mode=='non-capturing') return '\(?:' + formats.join('\|') + '\)';
        return '\(' + formats.join('\|') + '\)';
    }

    function updateMiddleButtons(firstErrorRow)
    {
        if (firstErrorRow)
        {
            parse_mcq_button.innerHTML = 'Fix<br>Error';
            document.getElementById(firstErrorRow).scrollIntoView( {behavior: 'smooth', block: 'center'} );
        }
        else
        {
            parse_mcq_button.innerHTML = 'Parse<br>MCQ</a>';
        }
    }
}

// check if the parsed_mcq table follows expected pattern, such as ' S #ABCD #ABCD S #ABCDE #AB #ABC S #ABCD  '
function validateParsedMcq()
{
    const rows = Array.from(parsed_mcq.children);
    let firstErrorRow = false;

    rows.forEach (function(row, index, array){
        if (index === 0) return; //skip table header
        if (index === rows.length-1) return; //skip last row, which is empty
        row.classList.remove('error');

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
            if (previousLabel!=='' || nextLabel!=='' || !isNum(nextNextLabel)) row.classList.add('error');
        }
        
        if (label==='') //empty lines should not occur in the middle of a '#ABCD' pattern
        {
            if (previousLabel==='A' || isNum(previousLabel) ||  ['A','B','C','D','E'].includes(nextLabel)) row.classList.add('error');
        }
        
        if (isNum(label)) //questions may only occur in the middle of a ' #A' pattern
        {
            if (previousLabel!=='' || nextLabel!=='A') row.classList.add('error');
        }

        if (label==='A') //'A' answers may only occur in the middle of a '#AB' pattern
        {
            if (!isNum(previousLabel) || nextLabel!=='B') row.classList.add('error');
        }

        if (label==='B') //'B' answers may only occur in the middle of 'ABC' or 'AB ' patterns 
        {
            if (previousLabel!=='A' || (nextLabel!=='C' && nextLabel!=='')) row.classList.add('error');
        }

        if (label==='C') //'C' answers may only occur in the middle of 'BCD' or 'BC ' patterns
        {
            if (previousLabel!=='B' || (nextLabel!=='D' && nextLabel!=='')) row.classList.add('error');
        }

        if (label==='D') //'D' answers may only occur in the middle of 'CDE' or 'CD ' patterns
        {
            if (previousLabel!=='C' || (nextLabel!=='E' && nextLabel!=='')) row.classList.add('error');
        }

        if (label==='E') //'E' answers may only occur in the middle of a 'DE ' pattern
        {
            if (previousLabel!=='D' || nextLabel!=='') row.classList.add('error');
        }

        if (label==='error') row.classList.add('error');

        if (!firstErrorRow)
        {
            if (label==='error') firstErrorRow = row.id;
            if (row.classList.contains('error')) firstErrorRow = row.id;
        }
    })

    return firstErrorRow;
}

function isNum(label)
{
    if (/^\d{1,3}$/.test(label)) return true;
    return false;
}

//process question/answer format settings
function replaceSpecialChars(input)
{
    input = input.value || input.textContent;
    return input
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') //add backslash to escape special regex characters
        .replaceAll('\u21B5', '\\n') //↵
        .replaceAll('\u2026', '\\s*') //…
        .replaceAll('\u21E5', '\\t') //⇥
        .replaceAll('\u2022', '\\s') //•
        .replaceAll('\u00A0', ' '); //nbsc - override default contenteditable behavior
}

//Parse user input from input_ak textarea. Build/validate parsed_ak table. Populate key-column in parsed_mcq table.
function parseAk()
{
    const userInput = input_ak.value.toUpperCase();
    if(!userInput) return input_ak.select();

    const before = ak_q_prefix.textContent ? replaceSpecialChars(ak_q_prefix) : '\\D';
    const beforeQuestionNum = new RegExp(before + '(?=' + '\\d{1,3}' + replaceSpecialChars(ak_q_postfix) + ')', 'gi');
    const rawKeys = (userInput+' ').split(beforeQuestionNum).filter(Boolean) || [userInput]; //Split userInput into array of rawKey strings. Each rawKey is one number followed by text (or by ' ' if userInput ends with a number)
    const rowsMcq = Array.from(parsed_mcq.children);
    const answers = parsed_mcq.getElementsByClassName('answer');
    let numbers=[];
    for (const answer of answers) answer.children[3].firstElementChild.checked = false; //reset all key-column checkboxes to not checked
    reset('parsed_ak');

    //nested forEach loops: go through each rawKey and compare it to each parsed_mcq row
    rawKeys.forEach(function(rawKey){        
        const rowAk = document.createElement('tr');
        const questionTdAk = document.createElement('td');
        const answerTdAk = document.createElement('td');
        const errorMessageTdAk = document.createElement('td');
        const number = (rawKey.match(/\d{1,3}/) || [false])[0] || '';
        questionTdAk.textContent = number;
        const key = rawKey.replace(new RegExp('\\d{1,3}' + replaceSpecialChars(ak_q_postfix), 'i'), '');

        let correctAnswers = [];
        for (const letter of ['A','B','C','D','E'])
        {
            if (!key.includes(replaceSpecialChars(ak_a_prefix) + letter + replaceSpecialChars(ak_a_postfix))) continue;
            correctAnswers.push(letter);
            answerTdAk.textContent+=letter;
        }
        if (firstLetterOnly.value)
        {
            const label = new RegExp ('(?:' + replaceSpecialChars(ak_a_prefix) + ')' + '([ABCDE])' + '(?:' + replaceSpecialChars(ak_a_postfix) + ')', 'i');
            const firstMatch = key.match(label);
            correctAnswers = firstMatch ? [firstMatch[1]] : [];
            answerTdAk.textContent = firstMatch ? firstMatch[1] : '';
        }

        rowAk.append(questionTdAk);
        rowAk.append(answerTdAk);
        rowAk.append(errorMessageTdAk);
        parsed_ak.append(rowAk);

        if (!number) return setError('no # in key', rowAk);
        if (correctAnswers.length === 0) return setError('no let&#xAD;ter in key', rowAk);
        if (numbers.includes(number)) return setError('dup&#xAD;li&#xAD;cate # in key', rowAk);
        numbers.push(number);

        let matchCount = 0; //number of times question number from answer key is found in parsed_mcq question numbers

        rowsMcq.forEach(function(rowMcq, qRowId){
            if (!rowMcq.classList.contains('question')) return;

            if (rowMcq.children[0].textContent == number) //for each Mcq row that has a question, check if it matches the number in the current rawKey
            {
                matchCount++;

                for (let id = qRowId+1; id <= qRowId+5; id++)
                {
                    const letter = rowsMcq[id].children[0].textContent;
                    if (correctAnswers.includes(letter))
                    {
                        rowsMcq[id].children[3].firstElementChild.checked = true;
                        correctAnswers = correctAnswers.filter(answer => answer !== letter); //remove letter from correctAnswers
                    }
                    if (!rowsMcq[id].classList.contains('answer')) break;
                }

                if (correctAnswers.length) return setError('let&#xAD;ter not in MCQ', rowAk); //e.g. answer D for 'true or false' Q
            }
        })

        if (matchCount === 0) return setError('# not in MCQ', rowAk);
        if (matchCount > 1) return setError('dup&#xAD;li&#xAD;cate # in MCQ', rowAk);
    })

    createOutput();
    showGoToStep(3);

    function setError(message, rowAk)
    {
        rowAk.classList.add('error');
        rowAk.children[2].innerHTML = message;
    }
}

function shuffle(mode)
{
    if (mode==='sections') shuffleSections();
    if (mode==='questions') shuffleQuestions();
    if (mode==='answers') shuffleAnswers();
    validateParsedMcq();

    //shuffle sections in the parsed_mcq table, keep question order within each section intact
    function shuffleSections()
    {
        const sectionsByRow = splitParsedMcqIntoSections();

        const lockedIndexes = [];

        const sectionHeaders = Array.from(parsed_mcq.getElementsByClassName('section'));
        sectionHeaders.forEach(function(header,index){
            if (header.children[4].firstElementChild.checked) //user locks a section by checking the lock-column checkbox next to its header
            {
                lockedIndexes.push(index);
            }
        })

        shuffleArray(sectionsByRow, lockedIndexes);
        
        reset('parsed_mcq');

        const rows = sectionsByRow.flat(1); //sectionsByRow array has a depth of 1
        for (const row of rows) parsed_mcq.append(row);

        renumberQuestions(); // question #s are out of order because sections were shuffled
        createOutput();
    }

    //shuffle questions in the parsed_mcq table within their respective sections, keep answer order within each question intact
    function shuffleQuestions()
    {
        const sectionsByQuestion = splitParsedMcqIntoSectionsIntoQuestions();

        sectionsByQuestion.forEach(function(section){
            const lockedIndexes = [0]; //section[0] = [header, emptyrow] so should be auto-locked
            section.forEach(function(question,index){
                if (index == 0) return; // skip section header
                if (question[0].children[4].firstElementChild.checked) //user locks a question by checking the lock-column checkbox next to it
                {
                    lockedIndexes.push(index);
                }
            })
            shuffleArray(section, lockedIndexes);
        })

        reset('parsed_mcq');

        const rows = sectionsByQuestion.flat(2); //sectionsByQuestion has a depth of 2
        for (const row of rows) parsed_mcq.append(row);
  
        renumberQuestions(); //question #s are out of order because questions were shuffled
        createOutput();
    }

    //shuffle answer options in the parsed_mcq table within their respective questions
    function shuffleAnswers()
    {
        const sectionsByQuestion = splitParsedMcqIntoSectionsIntoQuestions(); //depth = 2
        const tableByQuestion = sectionsByQuestion.flat(1); //[[S],[Q],[Q],[S],[Q]...] [Q]=[row, row, row...]

        tableByQuestion.forEach(function(questionBlock){
            if (questionBlock[0].classList.contains('section')) return; //skip section headers
            const question = 0;
            const emptyline = questionBlock.length-1;
            const lockedIndexes = [question, emptyline];
            questionBlock.forEach(function(answer, index)
            {
                if (index == question || index == emptyline) return;
                if (answer.children[4].firstElementChild.checked)
                {
                    lockedIndexes.push(index);
                }
            })
            shuffleArray(questionBlock, lockedIndexes);  
        })

        reset('parsed_mcq');

        const rows = tableByQuestion.flat(1);
        for (const row of rows) parsed_mcq.append(row);

        reletterAnswers(); //answer letter labels are out of order because answers were shuffled
        createOutput();
    }

    //Shuffle array in place, skipping elements with [lockedIndexes]
    function shuffleArray(array, lockedIndexes)
    {
        lockedIndexes.sort();
        const unlockedElements = array; //elements in the passed array that should be shuffled
        const lockedElements = []; //elements in the passed array that should not be shuffled
        for (const i of lockedIndexes) lockedElements.push(array[i]); //add locked elements to the lockedElements array

        //TODO splice returns deleted items, use that to rewrite this code
        for (let i = lockedIndexes.length-1; i>=0; i--) //loop from end to start. if loop from start to end, indexes will shift when element is deleted
        {
            const lockedIndex = lockedIndexes[i];
            unlockedElements.splice(lockedIndex, 1); //remove locked elements from the unlockedElements array
        }

        for (let i = unlockedElements.length - 1; i > 0; i--)
        {
            const j = Math.floor(Math.random() * (i + 1));
            [unlockedElements[i], unlockedElements[j]] = [unlockedElements[j], unlockedElements[i]]; //shuffle unlockedElements
        }

        lockedIndexes.forEach(function(item, index){
            unlockedElements.splice(item, 0, lockedElements[index]); //return locked elements back into their original array indexes
        })

        array = unlockedElements;
    }

    //parsed_mcq=[[S],[S],[S]...]   [S]=[row,row,row,row...]
    function splitParsedMcqIntoSections()
    {
        const rows = Array.from(parsed_mcq.children);
        const sectionsByRow = [];

        rows.forEach(function(row,index){
            if (index==0) return; //skip table header

            if (row.classList.contains('section')) //if row is section header, create new section array
            {
                const section = [];
                section.push(row);
                sectionsByRow.push(section);
            }
            else //if row is a question/answer/empty line, add it to the current section array
            {
                const currentSectionIndex = sectionsByRow.length-1;
                sectionsByRow[currentSectionIndex].push(row);
            }
        })
        return sectionsByRow;
    }

    //[S]=[row,row,row,row...]   =>   [S]=[[header],[Q],[Q]...] [Q]=[row,row,row,row...]
    function splitIntoQuestions(section)
    {
        const questions = [];
        const sectionHeader = [section[0],section[1]]; //[header, emptyrow]
        questions.push(sectionHeader);

        section.forEach(function(row, index){
            if (index==0 || index==1) return; //skip sectionHeader

            if (row.classList.contains('question')) //if row is a question, create new question array
            {
                const question = [];
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
        const sectionsByRow = splitParsedMcqIntoSections();
        const sectionsByQuestion = [];

        sectionsByRow.forEach(function(section){
            sectionsByQuestion.push(splitIntoQuestions(section));  
        })
        return sectionsByQuestion;
    }

    //overwrite letter label for first answer under each question with 'A', second letter label with 'B' etc.
    function reletterAnswers()
    {
        const questionRows = parsed_mcq.getElementsByClassName('question');
        const letters = ['A', 'B', 'C', 'D', 'E'];

        for (const row of questionRows)
        {
            let letterIndex = 0;

            function reletterAnswer(row, letterIndex)
            {
                const nextRow = row.nextElementSibling;
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
    const rows = Array.from(parsed_mcq.children);
    let answerKey = '<p id="output_ak">Answer Key</p>';

    const beforeQ = before_q.value.replaceAll('\u23CE', '<br>').replaceAll('\u21E5', '<pre style="display: inline-block;">&Tab;</pre>');
    const afterQ = after_q.value.replaceAll('\u23CE', '<br>').replaceAll('\u21E5', '<pre style="display: inline-block;">&Tab;</pre>');
    const beforeA = before_a.value.replaceAll('\u23CE', '<br>').replaceAll('\u21E5', '<pre style="display: inline-block;">&Tab;</pre>');
    const afterA = after_a.value.replaceAll('\u23CE', '<br>').replaceAll('\u21E5', '<pre style="display: inline-block;">&Tab;</pre>');

    rows.forEach(function(row, index){

        if (index==0) return;//skip table header

        let text;//parsed_mcq row converts into this output text

        if (row.classList.contains('section'))
        {
            text = row.children[2].children[0].innerHTML; //in order to include <br>
        }

        if (row.classList.contains('empty_line'))
        {
            text = '';
        }

        if (row.classList.contains('question'))
        {
            text = beforeQ + row.children[0].textContent + afterQ + row.children[2].children[0].innerHTML; //allows user to put HTML into input_mcq
            answerKey += parseRowForKey(index); //add correctAnswers for this question to answerKey
        }

        if (row.classList.contains('answer'))
        {
            const letter = a_lowercase.value ? row.children[0].textContent.toLowerCase() : row.children[0].textContent;
            text = beforeA + letter + afterA + row.children[2].children[0].innerHTML;
        }
        
        output.insertAdjacentHTML('beforeend', text+'<br>')
    })

    output.insertAdjacentHTML('beforeend', answerKey);
    copy_button_1.style.display = 'block';
    copy_button_2.style.display = 'inline-block'; // 'block' messes up bottom margin
    
    //return answer key for one row with the given index
    function parseRowForKey(rowIndex)
    {
        const rows = Array.from(parsed_mcq.children);
        const row = rows[rowIndex];
        let answers = [];
        let i=1;
        while (rows[rowIndex+i].classList.contains('answer'))
        {
            answers.push(rows[rowIndex+i]);
            i++;
            if (i>5) break;
        }
        let correctAnswers = '';

        for (const row of answers)
        {
            if (row.children[3].firstElementChild.checked)
            {
                correctAnswers += row.children[0].textContent;
            }
        }
        return '<br>'+row.children[0].textContent+'. '+correctAnswers; //question number and letters of all correct answers for that question
    }
}

function copyOutput()
{
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(document.getElementById('output'));

    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('copy');
}

//overwrite questions #s in the label column with 1,2,3...n
function renumberQuestions()
{
    const questionRows = Array.from(parsed_mcq.getElementsByClassName('question'));
    questionRows.forEach(function(item,index){
        item.children[0].textContent = +renumber_questions_start.value + index;
    })
    document.querySelectorAll('#parsed_mcq th:nth-child(2), #parsed_mcq td:nth-child(2)').forEach(cell => {
        cell.style.display = 'table-cell';
    });
    createOutput();
}

function reset(table_name)
{
    if (table_name === 'parsed_mcq')
    {
        parsed_mcq.outerHTML = '<table id="parsed_mcq" style="display:table">'+
                                    '<tr id="0">'+
                                        '<th style="width:45px;">label</th>'+
                                        '<th style="width:45px;">old #</th>'+
                                        '<th onclick="toggleView()" class="minimal">text</th>'+
                                        '<th style="width:36px">key</th>'+
                                        '<th style="width:36px">lock</th>'+
                                    '</tr>'+
                                '</table>';
        user_guide.style.display = 'none';
        border_mimic.style.display = 'none';
        user_guide_button.innerHTML = '?';
        user_guide_button.classList.add('user_guide_tooltip');
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

function enterSampleMcq()
{
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
    'C. Jar Jar Binks\n'+
    'D. Chancellor Valorum\n'+
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
    '1.\tDarth Vader would \n'+
    'enjoy a long walk on the beach. \n'+
    '     a) true\n     '+
    ' B. false\n'+
    '    \n'+
    '2)  Select <u><b><i>all</i></b></u> characters who were secretly Sith Lords.  \n'+
    '    (A Chancellor\n'+
    'Palpatine\n'+
    '      b.    Mace Windu\n'+
    'C.  Jar Jar Binks\n'+
    'd. Chancellor Valorum\n'+
    '\n'+
    '2)  [This will create error in answer key] Select <u><b><i>all</i></b></u> characters who were secretly Sith Lords.  \n'+
    '    (A Chancellor Palpatine\n'+
    '      b.    Mace Windu\n'+
    'C.  Jar Jar Binks\n'+
    'd. Chancellor Valorum\n'+
    '\n'+
    '  The questions in this section refer to the Simpsons.\n'+
    '\n'+
    ' \n'+
    '\t4 <p>Who shot Mr. Burns?</p> <img src="https://upload.wikimedia.org/wikipedia/en/5/56/Mr_Burns.png" style="max-width:50%; max-height:50%; width:90px; height:150px">  \n'+
    '    a. Lisa\n'+
    'b Marge\n'+
    'c. Bart\n'+
    'D Homer\n'+
    '(E) Maggie\n'+
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

    if (window.getComputedStyle(element).display == 'none')
    {
        element.style.display = display;
    }
    else if (hide)
    {
        element.style.display = 'none';
    }

    if (window.getComputedStyle(user_guide).display == 'none')
    {
        parsed_mcq.style.display = 'table';
        border_mimic.style.display = 'none';
        user_guide_button.innerHTML = '?';
        setTimeout(() => {
                if (window.getComputedStyle(user_guide).display == 'none') user_guide_button.classList.add('user_guide_tooltip');
            },
            3000
        );
    }
    else
    {
        parsed_mcq.style.display = 'none';
        border_mimic.style.display = 'block';
        user_guide_button.innerHTML = '&#10005;'; // ✕
        user_guide_button.classList.remove('user_guide_tooltip');
    }
}

function toggleView()
{
    const th = parsed_mcq.querySelector('[onclick="toggleView()"]');
    th.className = (th.className == 'minimal') ? 'expanded' : 'minimal';

    for (const cell of parsed_mcq.querySelectorAll('.parsed_mcq_cell_div'))
    {
        if (cell.classList.contains('expanded_view'))
        {
            cell.classList.remove('expanded_view');
        }
        else
        {
            cell.classList.add('expanded_view');
        }
    };
}

function goToStep(step)
{
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

function showGoToStep(step)
{
    if (step === 2)
    {
        const isStep1 = input_mcq_div_nav.classList.contains('active');
        if (!isStep1) return;
        go_to_step_2_button.style.display = 'block';
    }

    if (step === 3)
    {
        const isStep2 = ak_div_nav.classList.contains('active');
        if (!isStep2) return;
        go_to_step_3_button.style.display = 'block';
    }
}

function highlightVocab(externalSelect=false)
{
    const allElements = document.querySelectorAll('#vocab_div *');
    for (let e of allElements) e.classList.remove('vocab_highlight');

    if (externalSelect) vocab.value = externalSelect;
    const selectedElements = document.getElementsByClassName(vocab.value);
    for (let e of selectedElements) e.classList.add('vocab_highlight');
}

function clearValue(input)
{
    document.getElementById(input).value = '';
}

function addRow(label_table)
{
    const row = document.createElement('tr');
    const rowId = 'r' + Date.now();
    row.innerHTML = '<td class="input" role="textbox" contenteditable></td>' +
                    '<td onclick="' + rowId + '.parentNode.removeChild(' + rowId + ')">&nbsp;&minus;&nbsp;</td>';
    row.setAttribute('id', rowId);
    const lastRow = label_table.rows[label_table.rows.length - 1];
    label_table.children[0].insertBefore(row, lastRow);
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

function test(mode=1)
{
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
