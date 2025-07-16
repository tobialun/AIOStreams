import { Addon, Option, UserData, Resource, Stream } from '../db';
import { baseOptions, Preset } from './preset';
import { Env } from '../utils';
import { constants, ServiceId } from '../utils';
import { StreamParser } from '../parser';

class StremthruStoreStreamParser extends StreamParser {
  protected override applyUrlModifications(
    url: string | undefined
  ): string | undefined {
    if (!url) {
      return url;
    }
    if (
      Env.FORCE_STREMTHRU_STORE_HOSTNAME !== undefined ||
      Env.FORCE_STREMTHRU_STORE_PORT !== undefined ||
      Env.FORCE_STREMTHRU_STORE_PROTOCOL !== undefined
    ) {
      // modify the URL according to settings, needed when using a local URL for requests but a public stream URL is needed.
      const urlObj = new URL(url);

      if (Env.FORCE_STREMTHRU_STORE_PROTOCOL !== undefined) {
        urlObj.protocol = Env.FORCE_STREMTHRU_STORE_PROTOCOL;
      }
      if (Env.FORCE_STREMTHRU_STORE_PORT !== undefined) {
        urlObj.port = Env.FORCE_STREMTHRU_STORE_PORT.toString();
      }
      if (Env.FORCE_STREMTHRU_STORE_HOSTNAME !== undefined) {
        urlObj.hostname = Env.FORCE_STREMTHRU_STORE_HOSTNAME;
      }
      return urlObj.toString();
    }
    return url;
  }
}

export class StremthruStorePreset extends Preset {
  static override getParser(): typeof StreamParser {
    return StremthruStoreStreamParser;
  }

  static override get METADATA() {
    const supportedServices: ServiceId[] = [
      constants.REALDEBRID_SERVICE,
      constants.PREMIUMIZE_SERVICE,
      constants.ALLDEBRID_SERVICE,
      constants.TORBOX_SERVICE,
      constants.EASYDEBRID_SERVICE,
      constants.DEBRIDLINK_SERVICE,
      constants.OFFCLOUD_SERVICE,
      constants.PIKPAK_SERVICE,
    ];

    const supportedResources = [
      constants.STREAM_RESOURCE,
      constants.CATALOG_RESOURCE,
      constants.META_RESOURCE,
    ];

    const options: Option[] = [
      ...baseOptions(
        'StremThru Store',
        supportedResources,
        Env.DEFAULT_STREMTHRU_STORE_TIMEOUT
      ),
      {
        id: 'services',
        name: 'Services',
        description:
          'Optionally override the services that are used. If not specified, then the services that are enabled and supported will be used.',
        type: 'multi-select',
        required: false,
        options: supportedServices.map((service) => ({
          value: service,
          label: constants.SERVICE_DETAILS[service].name,
        })),
        default: undefined,
        emptyIsUndefined: true,
      },
      {
        id: 'webDl',
        name: 'Web DL',
        description: 'Enable web DL',
        type: 'boolean',
      },
      {
        id: 'socials',
        name: '',
        description: '',
        type: 'socials',
        socials: [
          {
            id: 'github',
            url: 'https://github.com/MunifTanjim/stremthru',
          },
          { id: 'buymeacoffee', url: 'https://buymeacoffee.com/muniftanjim' },
          { id: 'patreon', url: 'https://patreon.com/MunifTanjim' },
        ],
      },
    ];

    return {
      ID: 'stremthruStore',
      NAME: 'StremThru Store',
      LOGO: 'https://emojiapi.dev/api/v1/sparkles/256.png',
      URL: Env.STREMTHRU_STORE_URL,
      TIMEOUT: Env.DEFAULT_STREMTHRU_STORE_TIMEOUT || Env.DEFAULT_TIMEOUT,
      USER_AGENT:
        Env.DEFAULT_STREMTHRU_STORE_USER_AGENT || Env.DEFAULT_USER_AGENT,
      SUPPORTED_SERVICES: supportedServices,
      DESCRIPTION: 'Access your debrid library through catalogs and streams.',
      OPTIONS: options,
      SUPPORTED_STREAM_TYPES: [constants.DEBRID_STREAM_TYPE],
      SUPPORTED_RESOURCES: supportedResources,
    };
  }

  static async generateAddons(
    userData: UserData,
    options: Record<string, any>
  ): Promise<Addon[]> {
    // url can either be something like https://torrentio.com/ or it can be a custom manifest url.
    // if it is a custom manifest url, return a single addon with the custom manifest url.
    if (options?.url?.endsWith('/manifest.json')) {
      return [this.generateAddon(userData, options, undefined)];
    }

    const usableServices = this.getUsableServices(userData, options.services);
    // if no services are usable, throw an error
    if (!usableServices || usableServices.length === 0) {
      throw new Error(
        `${this.METADATA.NAME} requires at least one usable service, but none were found. Please enable at least one of the following services: ${this.METADATA.SUPPORTED_SERVICES.join(
          ', '
        )}`
      );
    }

    return usableServices.map((service) =>
      this.generateAddon(userData, options, service.id)
    );
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
        : undefined,
      manifestUrl: this.generateManifestUrl(userData, options, serviceId),
      enabled: true,
      library: true,
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
    if (!serviceId) {
      throw new Error(
        `${this.METADATA.NAME} requires at least one service, but none were found. Please enable at least one of the following services: ${this.METADATA.SUPPORTED_SERVICES.join(
          ', '
        )}`
      );
    }
    const configString = this.base64EncodeJSON({
      store_name: serviceId,
      store_token: this.getServiceCredential(serviceId, userData, {
        [constants.OFFCLOUD_SERVICE]: (credentials: any) =>
          `${credentials.email}:${credentials.password}`,
        [constants.PIKPAK_SERVICE]: (credentials: any) =>
          `${credentials.email}:${credentials.password}`,
      }),
      hide_catalog: false,
      hide_stream: false,
      webdl: options.webDl ?? false,
    });

    return `${url}${configString ? '/' + configString : ''}/manifest.json`;
  }
}
