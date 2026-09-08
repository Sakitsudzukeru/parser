export interface DataFormat {
  d_0: string;
  d_1: number;
  d_2: string;
  d_3: string;
  d_4: string;
  d_5: number;
  d_6: number;
  d_7: {
    d_7_1: number;
    d_7_2: number;
    d_7_3: number;
    d_7_4: number;
    d_7_5: number;
    d_7_6: number;
  };
  d_8: {
    d_8_1: number;
    d_8_2: number;
    d_8_3: number;
    d_8_4: number;
    d_8_5: number;
    d_8_6: number;
  };
  d_9: number;
  d_10: string;
  d_11: number;
  d_12: string;
  d_13: string;
  d_14: string;
  d_15: string;
  d_16: number;
  d_17: number;
  d_18: number;
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
}
