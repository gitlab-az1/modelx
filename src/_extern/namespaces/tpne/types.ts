export interface DatasetMetadata {

  /**
   * It's the unique identifier of
   * the image and will be used as the filename
   * as the example: `/path/to/[_id].jpeg`
   */
  readonly _id: string;

  /**
   * The number of the set where the image
   * was collected and stored.
   */
  set_number: number;

  age_interval: readonly [number, number];

  /**
   * The gender of the target image.
   * 
   * It's encoded like this:
   * - `'m' is equals to 'male'`
   * - `'f' is equals to 'female'`
   */
  gender: 'm' | 'f';

  /**
   * The age group of the target image.
   * 
   * It's encoded like this:
   * - `'b' is equals to 'baby'`
   * - `'c' is equals to 'children'`
   * - `'a' is equals to 'adult'`
   * - `'o' is equals to 'older'`
   */
  age_group: 'a' | 'b' | 'c' | 'o';

  /** The text description of the hair color of the target image */
  hair_color: string;

  /** The text description of the hair style of the target image */
  hair_style: string;

  /** The text description of the eyes color of the target image */
  eyes_color: string;

  /** The text description of the skin color of the target image */
  skin_color: string;

  /** The text description of the race of the target image */
  race: string;

  distortion: number;
  dx: number;
}


export interface ProfileMetadata {
  readonly _id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  birth_country: string;
  current_country: string;
  email_addr: string;
  uname: string;
  favorite_color: string;
  height: number;
  height_unit: string;
  weight: number;
  weight_unit: string;
  guid: string;
  ua: string;
}
