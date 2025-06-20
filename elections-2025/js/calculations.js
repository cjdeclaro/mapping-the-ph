function calculateAverageTurnout(dataArray) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return 0;
  }

  const totalTurnout = dataArray.reduce((sum, entry) => {
    const turnout = entry ? entry.information.turnout : 0;
    return sum + turnout;
  }, 0);

  return totalTurnout / dataArray.length;
}


function tallyVotes(allResults, totalBarangayVoters, filterName = null, filterName2 = null) {
  const tally = {};
  let totalVotes = 0;

  // Aggregate votes per candidate
  for (const result of allResults) {
    for (const candidate of result) {
      const {
        name,
        votes
      } = candidate;
      totalVotes += votes;

      if (!tally[name]) {
        tally[name] = {
          name,
          votes: 0
        };
      }

      tally[name].votes += votes;
    }
  }

  // Convert tally to array and calculate percentages
  const finalResults = Object.values(tally)
  .filter(candidate => !filterName || (candidate.name === filterName || candidate.name === filterName2 ))
  .map(candidate => ({
    name: candidate.name,
    votes: candidate.votes,
    percentage: ((candidate.votes / totalBarangayVoters) * 100).toFixed(2)
  }));

  // Sort by votes descending
  finalResults.sort((a, b) => b.votes - a.votes);

  return finalResults;
}

function calculateBarangayResults(precinctData, filterName = null, filterName2 = null) {
  nationalSenatorResults = [];
  nationalPatylistResults = [];

  totalBarangayVoters = 0;

  precinctData.forEach(precinct => {
    nationalSenatorResults.push(precinct.national[0].candidates.candidates);
    totalBarangayVoters += precinct.information.numberOfActuallyVoters;
  });

  precinctData.forEach(precinct => {
    nationalPatylistResults.push(precinct.national[1].candidates.candidates);
  });

  var totalSenatorBrgyVotes = tallyVotes(nationalSenatorResults, totalBarangayVoters, filterName, filterName2);
  var totalPartylistBrgyVotes = tallyVotes(nationalPatylistResults, totalBarangayVoters);

  return {
    "voteTally": {
      "averageVoterTurnOut": calculateAverageTurnout(precinctData).toFixed(2),
      "partylistBrgyVotes": totalPartylistBrgyVotes,
      "senatorBrgyVotes": totalSenatorBrgyVotes
    },
    "totalBarangayVoters": totalBarangayVoters
  };
}

function getAllWinners(dataArray) {
  const senatorTotals = {};
  const partylistTotals = {};

  dataArray.forEach(item => {
    item.voteTally.senatorBrgyVotes.forEach(candidate => {
      if (!senatorTotals[candidate.name]) {
        senatorTotals[candidate.name] = 0;
      }
      senatorTotals[candidate.name] += candidate.votes;
    });

    item.voteTally.partylistBrgyVotes.forEach(party => {
      if (!partylistTotals[party.name]) {
        partylistTotals[party.name] = 0;
      }
      partylistTotals[party.name] += party.votes;
    });
  });

  const senatorialWinner = Object.entries(senatorTotals).reduce((max, [name, votes]) =>
    votes > max.votes ? {
      name,
      votes
    } : max, {
      name: "",
      votes: 0
    });

  const partylistWinner = Object.entries(partylistTotals).reduce((max, [name, votes]) =>
    votes > max.votes ? {
      name,
      votes
    } : max, {
      name: "",
      votes: 0
    });

  return {
    senatorialWinner,
    partylistWinner
  };
}