import { isAddress, getAddress } from "@ethersproject/address";
import db from '../mysql';

export async function storeProposal(space, body, authorIpfsHash, relayerIpfsHash) {
  const msg = JSON.parse(body.msg);
  let query = 'INSERT IGNORE INTO messages SET ?;';
  await db.queryAsync(query, [{
    id: authorIpfsHash,
    address: body.address,
    version: msg.version,
    timestamp: msg.timestamp,
    space,
    type: 'proposal',
    payload: JSON.stringify(msg.payload),
    sig: body.sig,
    metadata: JSON.stringify({
      relayer_ipfs_hash: relayerIpfsHash
    })
  }]);
}

export async function storeVote(space, body, authorIpfsHash, relayerIpfsHash) {
  const msg = JSON.parse(body.msg);
  let query = 'INSERT IGNORE INTO messages SET ?;';
  await db.queryAsync(query, [{
    id: authorIpfsHash,
    address: body.address,
    version: msg.version,
    timestamp: msg.timestamp,
    space,
    type: 'vote',
    payload: JSON.stringify(msg.payload),
    sig: body.sig,
    metadata: JSON.stringify({
      relayer_ipfs_hash: relayerIpfsHash
    })
  }]);
}

export async function getActiveProposals(spaces) {
  const ts = parseInt((Date.now() / 1e3).toFixed());
  let query = `
    SELECT space, COUNT(id) AS count FROM messages WHERE
    type = 'proposal' 
    AND space != ''
    AND JSON_EXTRACT(payload, "$.start") <= ?
    AND JSON_EXTRACT(payload, "$.end") >= ?
    AND (`;
  const params = [ts, ts];

  Object.entries(spaces).forEach((space: any, i) => {
    if (i !== 0) query += ' OR ';
    query += '(space = ?';
    params.push(space[0]);

    // Filter only members proposals
    if (Array.isArray(space[1].members) && space[1].members.length > 0) {
      const members = space[1].members
        .filter(member => isAddress(member))
        .map(member => getAddress(member));
      query += ' AND address IN (?)';
      params.push(members);
    } else {
      query += ' AND address = 1'
    }

    // Filter out invalids proposals
    if (
      space[1].filters
      && Array.isArray(space[1].filters.invalids)
      && space[1].filters.invalids.length > 0
    ) {
      query += ' AND id NOT IN (?)';
      params.push(space[1].filters.invalids);
    }

    query += ')';
  });
  query += ') GROUP BY space';
  return await db.queryAsync(query, params);
}
