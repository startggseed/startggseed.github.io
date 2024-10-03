
//Finds phases of an event when apikey and tournament link are entered
async function onKeyOrLinkUpdate(){
  link = document.getElementById("link").value
  apikey = document.getElementById("apikey").value
  dropdown = document.getElementById("dropdown")
  phaseText = document.getElementById("phaseText")
  if(/^https:\/\/www.start.gg\/tournament\/.*\/event\/.*/.test(link)){
    phaseInfo = await getPhaseInfo(link.substring(21), apikey)

    if (phaseInfo == null || phaseInfo.length < 1) { //If the link + apikey dont work, hide phase selection
      dropdown.style.display = "none"
      phaseText.innerHTML = ""
      return false
    } else { //If link + apikey both work, show a selection of phases
      dropdown.style.display = "block"
      phaseText.innerHTML = "Select Phase: "

      while (dropdown.options.length > 0) {
        dropdown.remove(0);
      }
      for (phase of phaseInfo) {
        const option = document.createElement("option");
        option.value = phase.id;
        option.text = phase.name;
        dropdown.add(option);
      }
    }
  }
}

  //Main function
  async function applySeeding(link,apikey){
    try{
      seedMapping = await convertCSV()
    } catch (error) {
      alert("Error getting spreadsheet info")
    }

    test = await verifyTournamentLink(link.substring(21),apikey)
    if(test == null){
        return false
    }

    try {
      await doSeeding(document.getElementById("dropdown").value, seedMapping, apikey)
      alert("Success")
    } catch (e) {
      alert("Error occurred when attempting to seed phase")
    }
  }

  //Converts input file to a list of objects containing phase seed and seed id
  async function convertCSV() {
    return new Promise((resolve, reject) => {
      const input = document.getElementById("fileSelect").files[0];
      const reader = new FileReader();
      let result;
      reader.onload = function (e) {
        result = e.target.result;
        result = result.replaceAll("\r", "");
        arr = result.split('\n');
        var jsonObj = [];
        var headers = arr[0].toLowerCase().split(',').map((str) => str.replaceAll("\"", ""))

        if (headers.includes("seed id") && headers.includes("phase seed")) {
          for(var i = 1; i < arr.length; i++) {
            var data = arr[i].split(',');
            var obj = {};
            for(var j = 0; j < data.length; j++) {
              obj[headers[j]] = data[j];
            }
            jsonObj.push(obj);
          }
        } else {
          for(var i = 0; i < arr.length; i++) {
            var data = arr[i].split(',');
            var obj = {
              "phase seed": data[0],
              "seed id": data[1]
            };
            jsonObj.push(obj);
          }
        }

        jsonObj.sort((a, b) => a["phase seed"] - b["phase seed"]);

        const seedMapping = jsonObj.map((obj) => ({
          seedId: obj["seed id"],
          seedNum: obj["phase seed"],
        }))

        
        resolve(seedMapping);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(input);
    });
  }
  
  //Checks to make sure apikey and tournament link are valid
  async function verifyTournamentLink(slug, apikey) {
      query = `query EventQuery ($slug: String){
          event(slug: $slug){
            numEntrants
            tournament{
              admins{
                id
              }
            }
          }
        }`;
      variables = {
        "slug": slug
      }
      
      data = await queryAPI(query, variables, apikey)
  
      //apikey check
      if(data.message == "Invalid authentication token"){
          alert("Invalid apikey")
          return null
      }
      //If an error I didnt forsee happened
      if(data.data == null){
          alert("Unknown error occurred")
          return null
      }
      //tournament link check
      if(data.data.event == null){
          alert("Link doesn't match, use the format:\nhttps://www.start.gg/tournament/_/event/_")
          return null
      }
      //user admin check: gives an error if the apikey doesnt have permissions to seed the event
      if(data.data.event.tournament == null || data.data.event.tournament.admins == null){
          alert("Your APIKEY doesn't have permissions to seed the event\nMake sure your account is an admin in the tournament")
          return null
      }
      
      return data.data.event.numEntrants;
  }
  
  //Looks for the phaseId of the seeding
  async function getPhaseInfo(slug,apikey){
    query = `query EventQuery ($slug: String){
              event(slug: $slug){
                phases{
                  id
                  name
                }
              }
            }`;
    variables = {
      "slug": slug
    }
  
    data = await queryAPI(query, variables, apikey)
    try{
      return data.data.event.phases
    }catch(error){
      // console.log(error)
      return null
    }
  }

  //Queries the start.gg API with a given query, variables, and api key
  //Returns json output. 
  //Read more at https://developer.start.gg/docs/intro
  async function queryAPI(query, variables, apikey) {
      return await fetch('https://api.smash.gg/gql/alpha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + `${apikey}`
        },
        body: JSON.stringify({
          query,
          variables: variables,
        })
      }).then(r => { return r.json() }).catch(err => alert(err));
  }
  
  //Takes the calculated seedMapping and seeds the event
  async function doSeeding(phaseId, seedMapping, apikey){
    query = `mutation UpdatePhaseSeeding ($phaseId: ID!, $seedMapping: [UpdatePhaseSeedInfo]!) {
        updatePhaseSeeding (phaseId: $phaseId, seedMapping: $seedMapping) {
          id
        }
      }`;
    variables = {
      "phaseId": phaseId,
      "seedMapping": seedMapping
    }
  
    data = await queryAPI(query, variables, apikey)

    return data.data;
  }