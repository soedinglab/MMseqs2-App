import {
  mdiAlertCircleOutline as AlertCircleOutline,
  mdiArrowRightCircle as ArrowRightCircle,
  mdiArrowRightCircleOutline as ArrowRightCircleOutline,
  mdiAxisZRotateCounterclockwise as AxisZRotateCounterclockwise,
  mdiChevronLeft as ChevronLeft,
  mdiChevronRight as ChevronRight,
  mdiChevronUp as ChevronUp,
  mdiChevronDown as ChevronDown,
  mdiCircle as Circle,
  mdiCircleHalf as CircleHalf,
  mdiClockOutline as ClockOutline,
  mdiCloudDownloadOutline as CloudDownloadOutline,
  mdiDelete as Delete,
  mdiDns as Dns,
  mdiFile as File,
  mdiFileUpload as FileUpload,
  mdiFileDownloadOutline as FileDownloadOutline,
  mdiFormatListBulleted as FormatListBulleted,
  mdiFullscreen as Fullscreen,
  mdiHelpCircleOutline as HelpCircleOutline,
  mdiHistory as History,
  mdiLabel as Label,
  mdiLabelOutline as LabelOutline,
  mdiMagnify as Magnify,
  mdiMinusBox as MinusBox,
  mdiNotificationClearAll as NotificationClearAll,
  mdiPlusBox as PlusBox,
  mdiProgressWrench as ProgressWrench,
  mdiReorderHorizontal as ReorderHorizontal,
  mdiRestore as Restore,
  mdiTableLarge as TableLarge,
  mdiTune as Tune,
  mdiLayersSearchOutline as LayersSearchOutline,
  mdiCloseCircle as CloseCircle,
  mdiCloseCircleOutline as CloseCircleOutline,
  mdiWall as Wall,
  mdiTextBoxOutline as TextBoxOutline,
  mdiPencil as Pencil,
  mdiChevronDoubleUp as DoubleChevronUp,
} from "@mdi/js";

const ApplicationBracesOutline = `M21 2H3C1.9 2 1 2.9 1 4V20C1 21.1 1.9 22 3 22H21C22.1 22 23 21.1 23 20V4C23 2.9 22.1 2 21 2M21 20H3V6H21V20M9 8C7.9 8 7 8.9 7 10C7 11.1 6.1 12 5 12V14C6.1 14 7 14.9 7 16C7 17.1 7.9 18 9 18H11V16H9V15C9 13.9 8.1 13 7 13C8.1 13 9 12.1 9 11V10H11V8M15 8C16.1 8 17 8.9 17 10C17 11.1 17.9 12 19 12V14C17.9 14 17 14.9 17 16C17 17.1 16.1 18 15 18H13V16H15V15C15 13.9 15.9 13 17 13C15.9 13 15 12.1 15 11V10H13V8H15Z`;
const CircleOneThird = "M12 12 V2 A10 10 0 0 0 3.858 17.806 Z";
const CircleTwoThird = "M12 12 V2 A10 10 0 1 0 20.142 17.806 Z";
const SavePDB =
  "M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h14Zm0 8v-.8c0-.7-.6-1.2-1.3-1.2h-2.4v6h2.4c.7 0 1.2-.5 1.2-1.2v-1c0-.4-.4-.8-.9-.8.5 0 1-.4 1-1Zm-9.7.5v-1c0-.8-.7-1.5-1.5-1.5H5.3v6h1.5v-2h1c.8 0 1.5-.7 1.5-1.5Zm5 2v-3c0-.8-.7-1.5-1.5-1.5h-2.5v6h2.5c.8 0 1.5-.7 1.5-1.5Zm3.4.3h-1.2v-1.2h1.2v1.2Zm-5.9-3.3v3h1v-3h-1Zm-5 0v1h1v-1h-1Zm11 .9h-1.3v-1.2h1.2v1.2Z";
const SavePNG =
  "M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9 11.5C9 12.3 8.3 13 7.5 13H6.5V15H5V9H7.5C8.3 9 9 9.7 9 10.5V11.5M14 15H12.5L11.5 12.5V15H10V9H11.5L12.5 11.5V9H14V15M19 10.5H16.5V13.5H17.5V12H19V13.7C19 14.4 18.5 15 17.7 15H16.4C15.6 15 15.1 14.3 15.1 13.7V10.4C15 9.7 15.5 9 16.3 9H17.6C18.4 9 18.9 9.7 18.9 10.3V10.5H19M6.5 10.5H7.5V11.5H6.5V10.5Z";
const API =
  "M 22.23 1.96 c -0.98 0 -1.77 0.8 -1.77 1.77 c 0 0.21 0.05 0.4 0.12 0.6 l -8.31 14.23 c -0.8 0.17 -1.42 0.85 -1.42 1.7 a 1.77 1.77 0 0 0 3.54 0 c 0 -0.2 -0.05 -0.37 -0.1 -0.55 l 8.34 -14.29 a 1.75 1.75 0 0 0 1.37 -1.69 c 0 -0.97 -0.8 -1.77 -1.77 -1.77 M 14.98 1.96 c -0.98 0 -1.77 0.8 -1.77 1.77 c 0 0.21 0.05 0.4 0.12 0.6 l -8.3 14.24 c -0.81 0.16 -1.43 0.84 -1.43 1.7 a 1.77 1.77 0 0 0 3.55 0 c 0 -0.2 -0.06 -0.38 -0.12 -0.56 L 15.4 5.42 a 1.75 1.75 0 0 0 1.37 -1.69 c 0 -0.97 -0.8 -1.77 -1.78 -1.77 M 1.75 6 a 1.75 1.75 0 1 0 0 3.5 a 1.75 1.75 0 0 0 0 -3.5 z m 0 6 a 1.75 1.75 0 1 0 0 3.5 a 1.75 1.75 0 0 0 0 -3.5 z";
const Monomer =
  "m13.9 4.4.8.5a7.7 7.7 90 0 0 1.3.6 2.3 2.3 90 0 1 .5.2l.5.2.4.2.1.2a.4.4 90 0 1-.1.3A6.2 6.2 90 0 1 16 7a11.3 11.3 0 0 0-1.2.6l-.5-.2-1.1-.6a2 2 0 0 1-.5-.6 1.8 1.8 90 0 1-.2-1V3A5.3 5.3 90 0 0 14 4.4Zm-1.6-2c-.4-.8-1-1.3-1.6-1.3-1-.1-1.7.3-2.2 1.2a4.2 4.2 90 0 0-.3 1.3H10v12.9h2l-3.4 3.4.1 1.6c0 .4-.1.5-.4.5-.2 0 1.2-1-.4-.4L7.6 20l-3.3-3.4h1.9V3.6h1.1a7.4 7.4 90 0 1 .5-1.7C8.3.7 9.3.1 10.8.2a2.2 2.2 90 0 1 1.2.6A4.3 4.3 90 0 1 13 2v.3c0 .2 0 .4-.3.4-.2 0-.3 0-.4-.2Zm4.3 20.8a3 3 0 0 1-2.6-.5c-.8-.5-1.2-1.4-1.2-2.7 0-.3.1-.4.4-.4.3 0 .4.1.4.4 0 1 .3 1.7.8 2a2.5 2.5 90 0 0 2 .3h.1c.3 0 .5.2.5.5 0 .2-.1.3-.4.4Zm1.4-8v1a2.1 2.1 90 0 1-.3.5 2.6 2.6 90 0 1-.8.5l-.7.3-.6.3c-1.3.4-2 .7-2 .8a2.5 2.5 90 0 0-.8.5l-.2.3a3.3 3.3 90 0 1-.1-.8 5 5 90 0 1 0-1.3 2.4 2.4 90 0 1 .4-.8 3.6 3.6 90 0 1 .6-.4 38.4 38.4 0 0 1 4-1.9l.2-.3a2.6 2.6 90 0 1 .2.3 3.2 3.2 90 0 1 0 1Zm-5.2-1.8V13l.2-.4.7-.5 1-.3a7.7 7.7 90 0 0 1.3.6l.5.2.5.2.4.2.1.2-.1.2a2.4 2.4 90 0 1-.8.4 3 3 90 0 0-.5.2 1.9 1.9 90 0 1-.6.2l-.7.4-.5-.3a4.6 4.6 90 0 1-1.1-.5l-.2-.3-.2-.2ZM18 8.2a5.8 5.8 90 0 1 0 1 1.2 1.2 90 0 1-.3.5l-.5.3a189.3 189.3 90 0 0-3.6 1.5 2.5 2.5 90 0 0-.8.6l-.2.3-.1-.7v-1.3l.4-.9.5-.3L15.6 8l.6-.3a3.5 3.5 90 0 1 .5-.2l.9-.4.2-.3v.2l.2 1.1Z";
const Multimer =
  "M14 19.3c0-.3.2-.4.3-.5h.2c.3 0 .4.1.4.3.1.8.4 1.4 1 1.7.5.2 1 .3 1.5.1H17.7c.2-.1.4 0 .5.2 0 .3 0 .4-.3.5l-.4.2h-.3c-.5.1-1 0-1.7-.3-.4-.1-.7-.4-.9-.8a2.4 2.4 0 0 1-.4-1l-.1-.4Zm3.2-2h-.4a18.4 18.4 0 0 0-2.6.8l-.2.3v-.7c0-.5.1-.8.3-1l.6-.7.5-.3A63.2 63.2 0 0 1 18 15l.5-.2h.3l.3-.1.1-.1.3-.3v.2a7.5 7.5 0 0 1-.2 1.9l-.2.4-.8.4a15 15 0 0 0-.8.1h-.2Zm-5.1-.1v.6h-.6l-.4-.5-.6-.7-4.6-.8 1.5-1-5.9-8 .9-.7-.6-1.5c-.3-1.3.2-2.4 1.3-3.1l1.3-.3h.4l.4.1.2.1.6.4c.2 0 .3.2.2.5l-.4.2h-.2l-.4-.2-.8-.2c-.3 0-.6 0-.9.2a2 2 0 0 0-1 2.2l.6 1.1 1.3-1 1 1.4L5 8.6l1.4-1 3.8 5 1.5-1-.6 4.6.9 1Zm7-4-.1.3-.8.3a9 9 0 0 0-1.7.4 100.6 100.6 0 0 1-1.4-1.1v-.5c0-.1 0-.3.2-.4l.7-.3.8-.2.1.1.5.3.6.3a2092.6 2092.6 0 0 0 1.1.8Zm-8-2L7.2 6l-1.1.8.6-4 4 .7-1.1.8 4.2 5.7c-.4.5-.5 1.5-.4 3l-.6.4-.7-.9.2-2.2-1.2 1Zm9.2-3.7v1.2l-.2.8c0 .3-.2.4-.2.4l-.5.3a49.2 49.2 0 0 1-4.1 1l-.2.3V11c0-.4 0-.8.2-1.1l.5-.7.4-.3a19.2 19.2 0 0 1 4-1V7.4Zm-3.9-4.2c.3.5.6.9 1 1.1.2.4.5.6.6.6l.5.3a15.8 15.8 0 0 1 .8.6h.3l.1.2h.2c0 .2.2.3.3.3V7h-.5a2 2 0 0 0-.3.2l-.5.1-.5.1h-.1l-.3.1a1 1 0 0 0-.3 0l-.5-.2a4.7 4.7 0 0 1-1-1l-.2-.2V5l.4-2v.3Zm1.9-1.8c.1 0 .9-1.4 0-1.1-.9.2-1.5.7-1.8 1.5 0 .4 0 .7.5.8.4 0 .6-.1.7-.5 0-.3.3-.5.6-.7Z";
const Motif =
  "m12.42 17.45.15 1.38a.8.8 0 0 0 .34.57l1.69 1.4a.8.8 0 0 0 1.02-1.23l-1.5-1.24-.14-1.3 1.79-2.67-2.53-3.22-3.84 1.4.16 4.1 2.86.81Zm.4-1.55-1.71-.48-.07-1.77 1.66-.61 1.1 1.39-.99 1.47Zm-.3-6.77a2.4 2.4 0 1 0-3.02 1.52h-.01a2.4 2.4 0 0 0 3.02-1.52Zm7.03-3.1-2.21-2.32-3.7 1.77.55 4.05 4.02.74 1.42-2.62L21 7.8a.8.8 0 0 0 .62-.2l1.74-1.34a.8.8 0 0 0-.98-1.27l-1.54 1.19-1.3-.14Zm-1.35.9-.84 1.56-1.74-.32-.24-1.75 1.6-.77 1.22 1.28ZM4.57.05.69.55A.8.8 0 0 0 .9 2.16l3.58-.48L6.96 5a.8.8 0 0 0 1.28-.95L5.61.5a.8.8 0 0 0-.54-.46.8.8 0 0 0-.5 0Z";

export default {
  AlertCircleOutline,
  ApplicationBracesOutline,
  ArrowRightCircle,
  ArrowRightCircleOutline,
  AxisZRotateCounterclockwise,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Circle,
  CircleHalf,
  CircleOneThird,
  CircleTwoThird,
  ClockOutline,
  CloudDownloadOutline,
  Delete,
  Dns,
  File,
  FileDownloadOutline,
  FileUpload,
  FormatListBulleted,
  Fullscreen,
  HelpCircleOutline,
  History,
  Label,
  LabelOutline,
  Magnify,
  MinusBox,
  NotificationClearAll,
  PlusBox,
  ProgressWrench,
  ReorderHorizontal,
  Restore,
  SavePDB,
  SavePNG,
  TableLarge,
  Tune,
  LayersSearchOutline,
  API,
  CloseCircle,
  CloseCircleOutline,
  Monomer,
  Multimer,
  Wall,
  TextBoxOutline,
  Motif,
  Pencil,
  DoubleChevronUp,
};
