import jQuery from 'jquery';
import { default as config } from './config.js';
import axios from 'axios';

const moment = require('moment');

export const deepFreeze = (obj) => {
  if (obj !== null && typeof obj === 'object') {
    Object.getOwnPropertyNames(obj).forEach((prop) => {
      deepFreeze(obj[prop]);
    });
  }
  return obj;
};

export const toPromise = func => (...args) =>
    new Promise((resolve, reject) =>
        func(...args, (error, result) => (error ? reject(new Error(error.message)) : resolve(result)))
    );

export const formatNumber = (number, precision = 2) => {
  if (isNaN(number) || typeof number === 'undefined') { return 'Not Available'; }
  if (number === undefined || !number || typeof number !== 'number') { return number; }
  return number.toFixed(precision).replace(/./g, (c, i, a) => i && c !== '.' && ((a.length - i) % 3 === 0) ? ` ${c}` : c);
};

export const icoTransparencyLevel = Object.freeze({ NONTRANSPARENT: 'nontransparent', WITHISSUES: 'withissues', TRANSPARENT: 'transparent' });

export const criticalToTransparencyLevel = critical =>
  critical ? icoTransparencyLevel.NONTRANSPARENT : icoTransparencyLevel.WITHISSUES;

export const computeICOTransparency = (answers) => {
  const foundIssues = {};
  let hasCritical = false;

  for (const key in config.matrix) {
    if (config.matrix.hasOwnProperty(key)) {
      const answer = answers[key];
      const definition = config.matrix[key];
      // return lists of transparent-with-issues and non-transparent a answers
      if (answer.answer == false || answer.answer === null && !definition.notApplicable) {
        foundIssues[key] = true;
        hasCritical = hasCritical || definition.critical;
      }
    }
  }

  if (Object.keys(foundIssues).length !== 0) {
    return [criticalToTransparencyLevel(hasCritical), foundIssues];
  }
  return [icoTransparencyLevel.TRANSPARENT, foundIssues];
};

Date.prototype.formatDate = function (fullFormat = false) {
  return moment(this).format(fullFormat ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
};

String.prototype.capitalizeTxt = String.prototype.capitalizeTxt || function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

// coinbase requires UTC string
export const getEtherRate = async (currency, time) => axios.get(`https://api.coinbase.com/v2/prices/${currency}/spot?date=${time.toISOString()}`);

export const getICOs = () => Object.keys(config.ICOs).map((icoKey) => {
  const ico = config.ICOs[icoKey];
  ico.address = icoKey;
  return ico;
}
);

const isHexadecimal = (value) => {
  if (typeof value !== "string")
    return false;

  if (value.startsWith("-"))
    value = value.substring(1);

  value = value.toLowerCase();

  if (value.length <= 2 || !value.startsWith("0x"))
    return false;

  for (let i = 2; i < value.length; i++) {
    const c = value.charAt(i);

    if (!(c >= '0' && c <= '9' || c >= 'a' && c <= 'f'))
      return false;

  };

  return true;
};

export const getHexadecimalValueIfExist = (web3, value) => {
  return isHexadecimal(value) ? web3.toAscii(`0x${value.split("x")[1].replace(/0/g, '')}`) : value;
};


export const getValueOrNotAvailable = (props, input) => props && props[input] ? props[input] : 'Not Available';

export const getICOLogs = (blockRange, icoConfig, icoContract, callback) => {
  console.log(`Start scanning for block range ${blockRange}`);
  /* if (typeof localStorage !== 'undefined' && localStorage.getItem(address)) {
    console.log(`${address} cached already.`);
    return callback(null, JSON.parse(localStorage.getItem(address)));
  }*/
  const address = icoContract.address;
  const eventName = blockRange[2];
  const event = icoConfig.events[eventName];
  const filter = icoContract[eventName](event.customArgs || {}, {
    fromBlock: blockRange[0],
    toBlock: blockRange[1],
  });
  filter.stopWatching(() => {});

  jQuery.ajax({
    type: 'POST',
    url: config.rpcHost,
    Accept: 'application/json',
    contentType: 'application/json',
    // TODO: request data from cache
    // headers: {'X-Node-Cache': 'long'},
    data: JSON.stringify({
      id: 1497353430507566, // keep this ID to make cache work
      jsonrpc: '2.0',
      params: [{
        fromBlock: filter.options.fromBlock,
        toBlock: filter.options.toBlock,
        address,
        topics: filter.options.topics,
      }],
      method: 'eth_getLogsDetails',
    }),
    success: (e) => {
      if (e.error) {
        console.log(e);
        callback('SHOW_MODAL_ERROR', `Error when getting logs ${e.error.message}`);
      } else {
        const res = e.result;
        console.log(`formatting ${res.length} log entries`);
        const logsFormat = res.map(log => filter.formatter ? filter.formatter(log) : log);
        console.log('log entries formatted');
        callback(null, logsFormat);
      }
    },
    error: (status) => {
      callback('SHOW_MODAL_ERROR', `Error ${status}`);
    },
    dataType: 'json',
  });
};

export const initStatistics = () => ({
  general: {
    transactionsCount: 0,
  },
  time: {
    startDate: null,
    endDate: null,
    scale: 'blocks',
  },
  investors: {
    sortedByTicket: [],
    sortedByETH: [],
    senders: {},
  },
  money: {
    tokenIssued: 0,
    totalETH: 0,
  },
  charts: {
    transactionsCount: [],
    tokensCount: [],
    investorsDistribution: [],
    investmentDistribution: [],
    tokenHolders: [],
  },
});

const calculateTicks = (max) => {
  let tick = 0.1;
  const ticks = [];
  ticks.push(tick);
  while (tick < max) {
    tick *= 10;
    ticks.push(tick);
  }

  return ticks;
};

export const kFormatter = (num) => {
  const ranges = [
        { divider: 1e18, suffix: 'P' },
        { divider: 1e15, suffix: 'E' },
        { divider: 1e12, suffix: 'T' },
        { divider: 1e9, suffix: 'G' },
        { divider: 1e6, suffix: 'M' },
        { divider: 1e3, suffix: 'k' },
  ];

  for (let i = 0; i < ranges.length; i++) {
    if (num >= ranges[i].divider) {
      return (num / ranges[i].divider).toString() + ranges[i].suffix;
    }
  }
  return num.toString();
};

export const getEtherDistribution = (sortedInvestors, currencyPerEther) => {
  const max = sortedInvestors[0].value * currencyPerEther;
  // investors
  const investorsChartXAxis = [];
  // investment
  const investmentChartXAxis = [];

  const ticks = calculateTicks(max);
  let previousTick = 0;
  let xAxisLength = 0;
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    const name = `${kFormatter(previousTick)} - ${kFormatter(tick)}`;
    investorsChartXAxis.push({ name: `${name}`, amount: 0 });
    investmentChartXAxis.push({ name: `${name}`, amount: 0 });
    previousTick = tick;
    xAxisLength = i;
  }

  sortedInvestors.forEach((item) => {
    const money = item.value * currencyPerEther;
    for (let i = 0; i < xAxisLength; i++) {
      if (money < ticks[i]) {
        investorsChartXAxis[i].amount += 1;
        investmentChartXAxis[i].amount += parseFloat(money.toFixed(2));
        break;
      }
    }
  });

  return [investorsChartXAxis, investmentChartXAxis];
};

const formatDuration = duration => `${duration.get('years') > 0 ? `${duration.get('years')} Years` : ''}
            ${duration.get('months') > 0 ? `${duration.get('months')} Months` : ''}
            ${duration.get('days') > 0 ? `${duration.get('days')} Days` : ''}

            ${duration.get('hours') > 0 ? `${duration.get('hours')} Hours` : ''}
            ${duration.get('minutes') > 0 ? `${duration.get('minutes')} Minutes` : ''}
            ${duration.get('seconds') > 0 ? `${duration.get('seconds')} Seconds` : ''}`;

const sortInvestorsByTicket = (investors) => {
  const sortedByTokens = [];
  const sortedByETH = [];
  Object.keys(investors).forEach((key) => {
    const s = investors[key];
    sortedByTokens.push({
      investor: key,
      value: s.tokens,
    });
    sortedByETH.push({
      investor: key,
      value: s.ETH,
    });
  });
  sortedByTokens.sort((first, last) => last.value - first.value);
  sortedByETH.sort((first, last) => last.value - first.value);

  return [sortedByTokens, sortedByETH];
};

export const getPercentagesDataSet = (limit = 100) => {
  const percentages = [];
  let i = 1;
  while (i < limit) {
    percentages.push(i * 0.01);
    i += i < 5 ? 4 : (i < 9 ? 5 : 10);
  }
  return percentages;
};

export const tokenHoldersPercentage = (total, sortedInvestors) => {
  const percentages = getPercentagesDataSet(100);
  let totalTokens = 0;
  let arrayIndex = 0;
  return percentages.map((singlePercent) => {
    const iterationNumbers = parseInt(sortedInvestors.length * singlePercent);

    while (arrayIndex < iterationNumbers) {
      totalTokens += sortedInvestors[arrayIndex].value;
      arrayIndex++;
    }
    return {
      name: `${singlePercent * 100}%`,
      amount: parseFloat(((totalTokens * 100) / total).toFixed(2)),
    };
  });
};


export const downloadCSV = fileName => async (dispatch, getState) => {
  console.log(getState());
  const csvContentArray = getState().scan.csvContent;

  let csvContent = ['Investor Address', 'Token Amount', 'Ether Value', 'Timestamp', '\n'].join(',');
  csvContentArray.forEach((item, index) => {
    const dataString = item.join(',');
    csvContent += index < csvContentArray.length ? `${dataString}\n` : dataString;
  });

  const csvData = new Blob([csvContent], { type: 'application/csv;charset=utf-8;' });
    // FOR OTHER BROWSERS
  const link = document.createElement('a');
  link.href = URL.createObjectURL(csvData);
  link.style = 'visibility:hidden';
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const getChartTimescale = (durationHours, startTimestamp) => {
  if (durationHours < 12) {
    return ['blocks', event => event.blockNumber];
  } else if (durationHours > 12 && durationHours < 96) {
    // difference in full hours
    return ['hours', event => 1 + ((event.timestamp - startTimestamp) / 3600) >> 0];
  }
  // difference in full days
  return ['days', event => 1 + ((event.timestamp - startTimestamp) / 86400) >> 0];
};

// allLogs contains dictionary {event_name: logs_array} where each logs_array is sorted by timestamp (by ETH node)
export const getStatistics = (icoConfig, allLogs, stats) => {
  console.log('stats started');
  const csvContentArray = [];

  // get event that defines investor transaction and extract timestamps that will scale the time charts
  const transactionLogs = allLogs[Object.keys(allLogs).filter(name => icoConfig.events[name].countTransactions)[0]];
  const startTimestamp = transactionLogs[0].timestamp;
  const endTimestamp = transactionLogs[transactionLogs.length - 1].timestamp;
  const startTime = new Date(startTimestamp * 1000);
  stats.time.startDate = startTime;
  const endTime = new Date(endTimestamp * 1000);
  stats.time.endDate = endTime;
  const icoDuration = moment.duration(moment(endTime).diff(moment(startTime)));
  stats.time.durationDays = icoDuration.get('days');
  stats.time.duration = formatDuration(icoDuration);

  const precision = 10 ** parseFloat(icoConfig.decimals);

  const chartTokensCountTemp = {};
  const chartTransactionsCountTemp = {};
  const duration = moment.duration(moment(new Date(endTimestamp * 1000)).diff(moment(new Date(startTimestamp * 1000))));
  const timeScale = getChartTimescale(duration.asHours(), startTimestamp);
  const toTimeBucket = timeScale[1];
  stats.time.scale = timeScale[0];
  console.log(transactionLogs[0].blockNumber, transactionLogs[transactionLogs.length - 1].blockNumber);

  const senders = stats.investors.senders;
  let tranCount = 0;

  Object.keys(allLogs).forEach((eventName) => {
    const eventArgs = icoConfig.events[eventName].args;
    const countTransactions = icoConfig.events[eventName].countTransactions;
    const events = allLogs[eventName];
    let prevTxHash = null;

    for (let i = 0; i < events.length; i++) {
      const item = events[i];
      // allow for ICOs that do not generate tokens: like district0x
      const tokenValue = eventArgs.tokens ? parseFloat(item.args[eventArgs.tokens].valueOf()) / precision : 0;
      // removed operations on bigint which may decrease precision!
      const etherValue = parseFloat(eventArgs.ether ? item.args[eventArgs.ether].valueOf() : parseInt(item.value)) / 10 ** 18;

      const investor = item.args[eventArgs.sender];
      csvContentArray.push([investor, tokenValue, etherValue, item.timestamp]); // (new Date(item.timestamp * 1000)).formatDate(true)

      // only if event is transaction event
      const timeBucket = toTimeBucket(item);
      if (countTransactions) {
        if (item.transactionHash !== prevTxHash) {
          if (timeBucket in chartTransactionsCountTemp) {
            chartTransactionsCountTemp[timeBucket] += 1;
          } else {
            chartTransactionsCountTemp[timeBucket] = 1;
          }
          prevTxHash = item.transactionHash;
          tranCount += 1;
        }
      }
      // skip empty transactions
      if (tokenValue > 0) {
        if (timeBucket in chartTokensCountTemp) {
          chartTokensCountTemp[timeBucket] += tokenValue;
        } else {
          chartTokensCountTemp[timeBucket] = tokenValue;
        }
      }

      if (tokenValue > 0 || etherValue > 0) {
        if (investor in senders) {
          const s = senders[investor];
          s.ETH += etherValue;
          s.tokens += tokenValue;
        } else {
          senders[investor] = { tokens: tokenValue, ETH: etherValue };
        }

        stats.money.totalETH += etherValue;
        stats.money.tokenIssued += tokenValue;
      }
    }
  });

  console.log('stats dictionaries');
  stats.general.transactionsCount = tranCount;
  stats.charts.transactionsCount = [];
  stats.charts.tokensCount = [];

  // when building charts fill empty days and hours with 0
  let timeIterator = stats.time.scale !== 'blocks' ?
    Array.from(new Array(toTimeBucket(transactionLogs[transactionLogs.length - 1])), (x, i) => i + 1) : Object.keys(chartTokensCountTemp);
  timeIterator.forEach(key => stats.charts.tokensCount.push({
    name: key,
    amount: key in chartTokensCountTemp ? parseFloat(chartTokensCountTemp[key].toFixed(2)) : 0,
  }));
  timeIterator = stats.time.scale !== 'blocks' ?
    Array.from(new Array(toTimeBucket(transactionLogs[transactionLogs.length - 1])), (x, i) => i + 1) : Object.keys(chartTransactionsCountTemp);
  timeIterator.forEach(key => stats.charts.transactionsCount.push({
    name: key,
    amount: key in chartTransactionsCountTemp ? parseFloat(chartTransactionsCountTemp[key].toFixed(2)) : 0,
  }));

  const sortedSenders = sortInvestorsByTicket(senders);
  stats.investors.sortedByTicket = sortedSenders[0];
  stats.investors.sortedByETH = sortedSenders[1];

  stats.charts.tokenHolders = tokenHoldersPercentage(
        stats.money.tokenIssued,
        stats.investors.sortedByTicket
    );
  console.log('stats done');
  return [stats, csvContentArray];
};
