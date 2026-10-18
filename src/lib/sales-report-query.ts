import { queryOptions } from '@tanstack/react-query';
import { getSalesReportData } from './sales-report.functions';
export const salesReportQuery=queryOptions({queryKey:['admin-sales-reports'],queryFn:()=>getSalesReportData()});