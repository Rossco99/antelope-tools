export const signTransaction = async (ual, transaction) => {
  if (!ual || !ual.activeUser) {
    throw new Error('noActiveUser')
  }

  return ual.activeUser.signTransaction(
    {
      actions: [transaction]
    },
    {
      broadcast: true
    }
  )
}
