import * as React from "react";
import { observer } from "mobx-react";
import { VictoryPie, VictoryContainer, VictoryLabel, VictoryLegend, Slice } from 'victory';
import { observable, computed, action, toJS } from "mobx";
import _ from "lodash";
import { UNSELECTED_COLOR } from "pages/studyView/StudyViewUtils";
import CBIOPORTAL_VICTORY_THEME from "shared/theme/cBioPoralTheme";
import { AbstractChart } from "pages/studyView/charts/ChartContainer";
import ifndef from "shared/lib/ifndef";
import { bind } from "bind-decorator";
import { ClinicalDataCountWithColor } from "pages/studyView/StudyViewPageStore";
import classnames from 'classnames';
import ClinicalTable from "pages/studyView/table/ClinicalTable";
import { If } from 'react-if';

export interface IPieChartProps {
    data: ClinicalDataCountWithColor[];
    filters: string[];
    onUserSelection: (values: string[]) => void;
    active: boolean;
    placement: 'left' | 'right';
    label?: string;
}

@observer
export default class PieChart extends React.Component<IPieChartProps, {}> implements AbstractChart {

    private svg: SVGElement;

    constructor(props: IPieChartProps) {
        super(props);
    }

    @bind
    private onUserSelection(filter: string) {
        let filters = toJS(this.props.filters);
        if (_.includes(filters, filter)) {
            filters = _.filter(filters, obj => obj !== filter);
        } else {
            filters.push(filter);
        }
        this.props.onUserSelection(filters);
    }

    private get userEvents() {
        const self = this;
        return [{
            target: "data",
            eventHandlers: {
                onClick: () => {
                    return [
                        {
                            target: "data",
                            mutation: (props: any) => {
                                this.onUserSelection(props.datum.value);
                            }
                        }
                    ];
                }
            }
        }];
    }

    @observable isTooltipHovered: boolean = false;
    @observable tooltipHighlightedRow: string | undefined = undefined;

    @bind
    @action private highlightedRow(value: string): void {
        this.tooltipHighlightedRow = value;
    }

    @computed private get showTooltip() {
        return this.props.active || this.isTooltipHovered
    }

    public downloadData() {
        return this.props.data.map(obj => obj.value + '\t' + obj.count).join('\n');
    }

    public toSVGDOMNode(): Element {
        const svg = this.svg.cloneNode(true) as Element;
        const legend = $(this.svg).find(".studyViewPieChartLegend").get(0);
        const legendBBox = legend.getBoundingClientRect();

        const height = + $(this.svg).height() + legendBBox.height;
        const width = Math.max($(this.svg).width(), legendBBox.width);

        // adjust width and height to make sure that the legend is fully visible
        $(svg).attr("height", height + 5);
        $(svg).attr("width", width);


        // center elements

        const widthDiff = Math.abs($(this.svg).width() - legendBBox.width);
        const shift = widthDiff / 2;
        const transform = `translate(${shift}, 0)`;

        if ($(this.svg).width() > legendBBox.width) {
            // legend needs to be centered wrt the pie chart
            $(svg).find(".studyViewPieChartLegend").attr("transform", transform);
        }
        else {
            // pie chart needs to be centered wrt the legend
            $(svg).find(".studyViewPieChartGroup").attr("transform", transform);
        }

        return svg;
    }

    @computed get totalCount() {
        return _.sumBy(this.props.data, obj => obj.count)
    }

    @computed get fill() {
        return (d: ClinicalDataCountWithColor) => {
            if (!_.isEmpty(this.props.filters) && !_.includes(this.props.filters, d.value)) {
                return UNSELECTED_COLOR;
            }
            return d.color;
        };
    }

    @computed get stroke() {
        return (d: ClinicalDataCountWithColor) => {
            if (!_.isEmpty(this.props.filters) && _.includes(this.props.filters, d.value)) {
                return "#cccccc";
            }
            return null;
        };
    }

    @computed get strokeWidth() {
        return (d: ClinicalDataCountWithColor) => {
            if (!_.isEmpty(this.props.filters) && _.includes(this.props.filters, d.value)) {
                return 3;
            }
            return 0;
        };
    }

    @computed get fillOpacity() {
        return (d: ClinicalDataCountWithColor) => {
            if (!_.isEmpty(this.props.filters) && !_.includes(this.props.filters, d.value)) {
                return '0.5';
            }
            return 1;
        };
    }

    @bind
    private tooltipMouseEnter(): void {
        this.isTooltipHovered = true;
    }

    @bind
    private tooltipMouseLeave(): void {
        this.isTooltipHovered = false;
    }

    @bind
    private x(d: ClinicalDataCountWithColor) {
        return d.value;
    }

    @bind
    private y(d: ClinicalDataCountWithColor) {
        return d.count;
    }

    @bind
    private label(d: ClinicalDataCountWithColor) {
        return ((d.count * 360) / this.totalCount) < 20 ? '' : d.count;
    }

    private victoryPie() {
        return (
            <VictoryPie
                standalone={false}
                theme={CBIOPORTAL_VICTORY_THEME}
                containerComponent={<VictoryContainer responsive={false} />}
                groupComponent={<g className="studyViewPieChartGroup" />}
                width={190}
                height={180}
                labelRadius={30}
                padding={30}
                labels={this.label}
                data={this.props.data}
                dataComponent={<CustomSlice />}
                labelComponent={<VictoryLabel />}
                events={this.userEvents}
                style={{
                    data: {
                        fill: ifndef(this.fill, "#cccccc"),
                        stroke: ifndef(this.stroke, "0x000000"),
                        strokeWidth: ifndef(this.strokeWidth, 0),
                        fillOpacity: ifndef(this.fillOpacity, 1)
                    },
                    labels: {
                        fill: "white"
                    }
                }}
                x={this.x}
                y={this.y}
            />
        );
    }

    private victoryLegend() {
        const legendData = this.props.data.map(data =>
            ({name: `${data.value}: ${data.count} (${(100 * data.count / this.totalCount).toFixed(2)}%)`}));
        const colorScale = this.props.data.map(data => data.color);

        // override the legend style without mutating the actual theme object
        const theme = _.cloneDeep(CBIOPORTAL_VICTORY_THEME);
        theme.legend.style.data = {
            type: "square",
            size: 5,
            strokeWidth: 0,
            stroke: "black"
        };

        return (
            <VictoryLegend
                standalone={false}
                theme={theme}
                colorScale={colorScale}
                x={0} y={181}
                rowGutter={-10}
                title={this.props.label || "Legend"}
                centerTitle
                style={{ title: { fontWeight: "bold" } }}
                data={legendData}
                groupComponent={<g className="studyViewPieChartLegend" />}
            />
        );
    }

    public render() {
        // 350px => width of tooltip
        // 195px => width of chart
        let left = _.isEqual(this.props.placement, 'right') ? 0 : -335
        return (
            <div>
                <If condition={this.showTooltip}>
                    <div
                        className={classnames('popover', this.props.placement)}
                        onMouseLeave={() => this.tooltipMouseLeave()}
                        onMouseEnter={() => this.tooltipMouseEnter()}
                        style={{ display: 'block', position: 'absolute', left: left }}>

                        <div className="popover-content">
                            <ClinicalTable
                                width={300}
                                height={150}
                                data={this.props.data}
                                filters={this.props.filters}
                                highlightedRow={this.highlightedRow}
                                onUserSelection={this.props.onUserSelection}
                            />
                        </div>
                    </div>
                </If>

                <svg
                    width={190}
                    height={180}
                    ref={(ref: any) => this.svg = ref}
                >
                    {this.victoryPie()}
                    {this.victoryLegend()}
                </svg>
            </div>
        );
    }

}

class CustomSlice extends React.Component<{}, {}> {
    render() {
        const d: any = this.props;
        return (
            <g>
                <Slice {...this.props} />
                <title>{`${d.datum.value}:${d.datum.count}`}</title>
            </g>
        );
    }
}