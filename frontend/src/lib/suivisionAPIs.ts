const x_api_key = 'apikey' // Replace with your actual API key
const base_url = 'https://api.blockvision.org/v2/sui/account/coins?account='
const defi_url = 'https://api.blockvision.org/v2/sui/account/defiPortfolio'

export const getSuiAccountBalance = async (address: string) => {
  const url = `${base_url}${address}`
  const response = await fetch(url, {
    headers: {
      'x-api-key': x_api_key
    }
  })
  const data = await response.json()
  return data
}

export const getSuiAccountDefiPortfolio = async (address: string) => {
  const url = `${defi_url}?address=${address}&protocol=cetus`
  const response = await fetch(url, {
    headers: {
      'x-api-key': x_api_key
    }
  })
  const data = await response.json()
  return data
}


