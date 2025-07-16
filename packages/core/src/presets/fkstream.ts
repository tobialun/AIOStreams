// stremio://new-who.onrender.com/manifest.json

import { Addon, Option, ParsedStream, Stream, UserData } from '../db';
import { Preset, baseOptions } from './preset';
import { constants, Env, ServiceId } from '../utils';

export class FKStreamPreset extends Preset {
  static override get METADATA() {
    const supportedResources = [
      constants.CATALOG_RESOURCE,
      constants.META_RESOURCE,
      constants.STREAM_RESOURCE,
    ];

    const options: Option[] = [
      ...baseOptions(
        'FKStream',
        supportedResources,
        Env.DEFAULT_FKSTREAM_TIMEOUT
      ),
      {
        id: 'defaultSort',
        name: 'Default Sort',
        description: 'Default sort for the catalogs',
        type: 'select',
        options: [
          { label: 'Last Updated ▼', value: 'last_update' },
          { label: 'Rating ▼', value: 'rating_value' },
          { label: 'Title ▲', value: 'title' },
          { label: 'Year ▼', value: 'year' },
        ],
        default: 'last_update',
      },
      {
        id: 'includeP2P',
        name: 'Include P2P',
        description:
          'Include P2P streams in the addon even when using a debrid service',
        type: 'boolean',
        default: false,
      },
      {
        id: 'socials',
        name: '',
        description: '',
        type: 'socials',
        socials: [{ id: 'website', url: 'https://linktr.ee/FanKai' }],
      },
    ];

    return {
      ID: 'fkstream',
      NAME: 'FKStream',
      LOGO: 'https://raw.githubusercontent.com/Dydhzo/fkstream/refs/heads/main/fkstream/assets/fkstream-logo.jpg',
      URL: Env.FKSTREAM_URL,
      TIMEOUT: Env.DEFAULT_FKSTREAM_TIMEOUT || Env.DEFAULT_TIMEOUT,
      USER_AGENT: Env.DEFAULT_FKSTREAM_USER_AGENT || Env.DEFAULT_USER_AGENT,
      SUPPORTED_SERVICES: [
        constants.TORBOX_SERVICE,
        constants.EASYDEBRID_SERVICE,
        constants.REALDEBRID_SERVICE,
        constants.DEBRIDLINK_SERVICE,
        constants.ALLDEBRID_SERVICE,
        constants.PREMIUMIZE_SERVICE,
        constants.OFFCLOUD_SERVICE,
        constants.PIKPAK_SERVICE,
      ],
      DESCRIPTION:
        'An unofficial addon for Fankai - French focused anime content. Bleach, One Piece, Dragon Ball, Naruto et une soixantaine de Kai. Viens voir !',
      OPTIONS: options,
      SUPPORTED_STREAM_TYPES: [
        constants.P2P_STREAM_TYPE,
        constants.DEBRID_STREAM_TYPE,
      ],
      SUPPORTED_RESOURCES: supportedResources,
    };
  }

  static async generateAddons(
    userData: UserData,
    options: Record<string, any>
  ): Promise<Addon[]> {
    if (options?.url?.endsWith('/manifest.json')) {
      return [this.generateAddon(userData, options, undefined)];
    }

    const usableServices = this.getUsableServices(userData, options.services);
    // if no services are usable, use p2p
    if (!usableServices || usableServices.length === 0) {
      return [this.generateAddon(userData, options, undefined)];
    }

    let addons = usableServices.map((service) =>
      this.generateAddon(userData, options, service.id)
    );

    if (options.includeP2P) {
      addons.push(this.generateAddon(userData, options, undefined));
    }

    return addons;
  }

  private static generateAddon(
    userData: UserData,
    options: Record<string, any>,
    serviceId?: ServiceId
  ): Addon {
    return {
      name: options.name || this.METADATA.NAME,
      identifier: serviceId
        ? `${constants.SERVICE_DETAILS[serviceId].shortName}`
        : options.url?.endsWith('/manifest.json')
          ? undefined
          : 'p2p',
      manifestUrl: this.generateManifestUrl(userData, options, serviceId),
      enabled: true,
      resources: options.resources || this.METADATA.SUPPORTED_RESOURCES,
      timeout: options.timeout || this.METADATA.TIMEOUT,
      presetType: this.METADATA.ID,
      presetInstanceId: '',
      headers: {
        'User-Agent': this.METADATA.USER_AGENT,
      },
    };
  }

  private static generateManifestUrl(
    userData: UserData,
    options: Record<string, any>,
    serviceId: ServiceId | undefined
  ) {
    let url = options.url || this.METADATA.URL;
    if (url.endsWith('/manifest.json')) {
      return url;
    }
    url = url.replace(/\/$/, '');
    const configString = this.base64EncodeJSON({
      streamFilter: 'all',
      debridService: serviceId || 'torrent',
      debridApiKey: serviceId
        ? this.getServiceCredential(serviceId, userData, {
            [constants.OFFCLOUD_SERVICE]: (credentials: any) =>
              `${credentials.email}:${credentials.password}`,
            [constants.PIKPAK_SERVICE]: (credentials: any) =>
              `${credentials.email}:${credentials.password}`,
          })
        : '',
      debridStreamProxyPassword: '',
      maxActorsDisplay: 'all',
      defaultSort: options.defaultSort || 'rating_value',
    });

    return `${url}${configString ? '/' + configString : ''}/manifest.json`;
  }
}
