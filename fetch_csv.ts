
const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRf9-kG7C2iO75HNB2y4roFZ55YS3gyMFMijGiJsVW8Qm7njs5rTsir6U8Cvi0pljaJAh17WvbqX7f/pub?output=csv';
fetch(url)
  .then(res => res.text())
  .then(text => console.log(text))
  .catch(err => console.error(err));
