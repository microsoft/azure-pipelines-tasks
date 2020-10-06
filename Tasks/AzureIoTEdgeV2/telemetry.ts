import * as appInsights from 'applicationinsights';
const metadata = {
  id: 'iot-edge-build-deploy',
  version: '2.4.3',
  publisher: 'vsc-iot',
}

const instrumentKey = 'fed7fc65-5b4a-4e66-9d46-c5f016d4e2b4';

appInsights.setup(instrumentKey);
let client = appInsights.defaultClient;

export default function traceEvent(name: string, property: Object) {
  // Zhiqing change default behavior or it will a minute to send retry request before the process exit
  // Patched the applicationinsights.js
  let properties = (<any>Object).assign({}, property, {
    'common.extname': `${metadata.publisher}.${metadata.id}`,
    'common.extversion': metadata.version,
  });
  client.trackEvent({
    name: `${metadata.publisher}.${metadata.id}/${name}`,
    properties,
  });
  client.flush();
}

export interface TelemetryEvent {
  hashTeamProjectId: string,
  taskType: string,
  osType: string,
  buildId: string,
  isSuccess: boolean
  taskTime: number,
  isACR?: boolean,
  hashIoTHub?: string,
  iotHubHostNameHash?: string,
  iotHubDomain?: string,
  fixedCliExtInstalled: boolean,
  error: string
}