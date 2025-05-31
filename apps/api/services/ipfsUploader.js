const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

const JWT = process.env.IPFSJWT;

const uploadToIPFS = async (filePath, originalName) => {
    const formData = new FormData();
    const file = fs.createReadStream(filePath);

    formData.append('file', file);
    formData.append('pinataMetadata', JSON.stringify({ name: originalName }));
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 0 }));

    const headers = {
        ...formData.getHeaders(),
        Authorization: `Bearer ${JWT}`,
    };

    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        { headers, maxBodyLength: 'Infinity' }
    );

    const ipfsHash = response.data.IpfsHash;
    const url = `https://i.degencdn.com/ipfs/${ipfsHash}`;

    return {
        ipfsHash,
        url,
    };
};

module.exports = { uploadToIPFS };
