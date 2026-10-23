const getOrderNode = node => {
  return (
    (node.type?.includes('full') ? 0.5 : 0) +
    (node.endpoints?.length || 0) +
    Boolean(node?.node_info[0]?.version?.length) +
    (node.node_info[0]?.features?.list?.length || 0)
  )
}

// Nodes that only sign blocks are merged into one "Producer" card (keys and
// locations); every other node, including one that is producer and query
// at once, is shown as its own card. A producer whose nodes are all
// producer-only still gets its Producer card.
const isProducerOnly = node =>
  node?.type?.length === 1 && node.type[0] === 'producer'

export const sortNodes = (unsortedNodes, key) => {
  const sorted = [...unsortedNodes].sort(
    (a, b) => getOrderNode(b) - getOrderNode(a),
  )
  const producerOnly = sorted.filter(isProducerOnly)
  // copies: the query results are frozen
  const nodes = JSON.parse(
    JSON.stringify(sorted.filter(node => !isProducerOnly(node))),
  )

  if (producerOnly.length) {
    nodes.push({
      ...producerOnly[0],
      locations: producerOnly.map(node => node.location),
      node_info: [{ features: { keys: { producer_key: key } } }],
    })
  }

  return nodes
}

export default sortNodes
