import React, { useState, useEffect } from 'react';
import Web3Modal from 'web3modal';
import { ethers } from 'ethers';
import axios from 'axios';
import { MarketAddress, MarketAddressABI } from './constants';

const fetchContract = (signerOrProvider) => new ethers.Contract(MarketAddress, MarketAddressABI, signerOrProvider);

export const NFTContext = React.createContext();

export const NFTProvider = ({ children }) => {
  const [currentAccount, setCurrentAccount] = useState('');
  const nftCurrency = 'ETH';

  const checkIfWalletIsConnected = async () => {
    if (!window.ethereum) {
      return alert('Please install MetaMask');
    }
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts.length) {
      setCurrentAccount(accounts[0]);
    } else {
      console.log('No Accounts Found');
    }
  };

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      return alert('Please install MetaMask');
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

    setCurrentAccount(accounts[0]);

    window.location.reload();
  };

  const uploadToPinata = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios({
        method: 'post',
        url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        data: formData,
        headers: {
          pinata_api_key: `
          7547315df2068ba11668`,
          pinata_secret_api_key: '00b86ba11aa49ebc73f59619c62410e4e8c45683576092b303d3a0168148e615',
          'Content-Type': 'multipart/form-data',
        },
      });
      const ImgHash = `https:/gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;

      return ImgHash;
    } catch (error) {
      console.log('Error uploading file to IPFS.', error);
    }
  };

  const createNFT = async (formInput, fileUrl, router) => {
    const { name, description, price } = formInput;
    if (!name || !description || !fileUrl) return;

    const data = JSON.stringify({ name, description, image: fileUrl });

    try {
      const response = await axios({
        method: 'POST',
        url: 'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        data,
        headers: {
          pinata_api_key: `
          7547315df2068ba11668`,
          pinata_secret_api_key: '00b86ba11aa49ebc73f59619c62410e4e8c45683576092b303d3a0168148e615',

        },
      });
      const url = `https://gateway.pinata.cloud.ipfs/${response.data.IpfsHash}`;
      console.log(url);

      await createSale(url, price);

      router.push('/');
    } catch (error) {
      console.log(error);
      console.log('Error uploading file to IPFS.');
    }
  };
  const createSale = async (url, formInputPrice, isReselling, id) => {
    const web3modal = new Web3Modal();
    const connection = await web3modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();

    const price = ethers.utils.parseUnits(formInputPrice, 'ether');
    const contract = fetchContract(signer);
    const listingPrice = await contract.getListingPrice();

    const transaction = await contract.createToken(url, price, { value: listingPrice.toString() });

    await transaction.wait();
  };

  const fetchNFTs = async () => {
    const provider = new ethers.providers.JsonRpcProvider();
    const contract = fetchContract(provider);

    const data = await contract.fetchMarketItems();

    const items = await Promise.all(data.map(async ({ tokenId, seller, owner, price: unformattedPrice }) => {
      const tokenURI = await contract.tokenURI(tokenId);
      const { data: { image, name, description } } = await axios.get(tokenURI);
      const price = ethers.utils.parseUnits(unformattedPrice.toString(), 'ether');

      return {
        price,
        tokenId: tokenId.toNumber(),
        seller,
        owner,
        image,
        name,
        description,
        tokenURI,
      };
    }));

    return items;
  };
  return (
    <NFTContext.Provider value={{ nftCurrency, connectWallet, currentAccount, uploadToPinata, createNFT, fetchNFTs }}>
      {children}
    </NFTContext.Provider>
  );
};
