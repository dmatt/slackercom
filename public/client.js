// client-side js
// run by the browser each time your view template referencing it is loaded

console.log('hello world :o');

let dataSet = [];

// define variables that reference elements on our page

// a helper function to call when our request for dreams is done
const getStatusListener = function() {
  // parse our response to convert to JSON
  dataSet = JSON.parse(this.responseText);
  makeGraph(dataSet);

  // iterate through every dream and add it to our page
  dataSet.forEach( function(row) {
    appendNewStatus(JSON.stringify(row));
  });
}

// request the dreams from our app's sqlite database
const statusRequest = new XMLHttpRequest();
statusRequest.onload = getStatusListener;
statusRequest.open('get', '/getStatus');
statusRequest.send();

// a helper function that creates a list item for a given dream
const appendNewStatus = function(status) {
  const newListItem = document.createElement('li');
  newListItem.innerHTML = status;

}


