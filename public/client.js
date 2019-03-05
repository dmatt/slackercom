// client-side js
// run by the browser each time your view template referencing it is loaded
/* global makeGraph */
/* eslint-env browser */

console.log('hello world :o');

let dataSet = [];

// a helper function that creates a list item for a given dream
const appendNewStatus = (status) => {
  const newListItem = document.createElement('li');
  newListItem.innerHTML = status;
};

// a helper function to call when our request for statusRequest is done
function getStatusListener() {
  // parse our response to convert to JSON
  dataSet = JSON.parse(this.responseText);
  makeGraph(dataSet);

  // iterate through every dream and add it to our page
  dataSet.forEach((row) => {
    appendNewStatus(JSON.stringify(row));
  });
}

// request the statusRequest from our app's sqlite database
const statusRequest = new XMLHttpRequest();
statusRequest.onload = getStatusListener;
statusRequest.open('get', '/getStatus');
statusRequest.send();
