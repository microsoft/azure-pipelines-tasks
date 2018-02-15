import * as os from 'os';

export function getMacAddress(): string[] {
	// Return an array of mac address of all the network interfaces 
	var macAddress = [];
	var networkInterfaces = os.networkInterfaces();
	Object.keys(networkInterfaces).forEach( (interfaceName) => {
		networkInterfaces[interfaceName].forEach( (interFace) => {
			if (interFace.internal) {
      			return;
    		}
    		macAddress.push(interFace.mac.toUpperCase().replace(/:/g, "-"));
		});
	});
	return macAddress;
}

export function getPrimaryNetworkInterface(nics) {
	var macAddress = this.getMacAddress();
	var primaryNic = null;
	for (var mac in macAddress) {
		for (var nic in nics) {
			if(nics[nic].properties.macAddress == macAddress[mac] && nics[nic].properties.primary) {
				primaryNic = nics[nic];
				break;
			}
		}	
	}
	return primaryNic;
}